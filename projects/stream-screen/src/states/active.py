from __future__ import annotations
import time

import rhpy
import event
from config import Config, StreamConfig, MainSettings
from shared import ChangeDirection, MenuName

log = rhpy.logs('state.active')

def _shift_index(current_index: int, direction: ChangeDirection, arr: list):
	max_index = max(0, len(arr) - 1)
	if direction == ChangeDirection.INC:
		return current_index + 1 if current_index < max_index else 0
	elif direction == ChangeDirection.DEC:
		return current_index - 1 if current_index > 0 else max_index
	return current_index

class _ActiveMenu():
	@property
	def name(self) -> MenuName:
		return self._available_menus[self._index]

	def __init__(self, available_menus: list[MenuName]):
		self._index = 0
		self._available_menus = available_menus
		event.subscribe(event.RequestMenuIndexChange, self._do_index_change)

	def event_payload_dict(self) -> event.pdict.ActiveMenu:
		return event.pdict.ActiveMenu(index=self._index, name=self.name)

	def _do_index_change(self, direction: ChangeDirection):
		self._index = _shift_index(self._index, direction, self._available_menus)
		event.publish(event.ActiveMenuChange, **self.event_payload_dict())
		log.info(f'Set menu index:{self._index} name:{self.name}')

class Active:
	@property
	def paused(self) -> bool:
		return MainSettings.paused
	@property
	def menu(self) -> MenuName | None:
		return self._menu.name if self._menu else None
	@property
	def visible_streams(self) -> list[StreamConfig]:
		with self._lock:
			return [s for s in Config.streams if s.visible]
	@property
	def stream(self) -> StreamConfig:
		with self._lock:
			return self.visible_streams[MainSettings.stream_index]
	@property
	def stream_index(self) -> int:
		return MainSettings.stream_index

	def __init__(self) -> None:
		self._lock = rhpy.PerfLock('active_state', rlock=True)
		self._menu = _ActiveMenu(Config.menus) if Config.menus else None
		self._stream_change_time = time.time()

		event.subscribe(event.RequestPauseChange, self._do_pause_change)
		if self._menu:
			log.info('Registering menu even listeners')
			event.subscribe(event.RequestMenuValueChange, self._do_menu_value_change)
			event.subscribe(event.RequestMenuIndexChange, self._do_menu_index_change)
		else:
			log.info('No menus configured, skipping menu event listeners')

	def _menu_is(self, *args: MenuName) -> bool:
		return bool(self._menu and self._menu.name in args)

	def _payload_active_stream(self) -> event.pdict.ActiveStream:
		with self._lock:
			return event.pdict.ActiveStream(index=self.stream_index, name=self.stream.name)

	def _payload_active_all(self) -> event.pload.ActiveAll:
		return event.pload.ActiveAll(
			menu=event.pload.ActiveMenu(**self._menu.event_payload_dict()) if self._menu else None,
			stream=event.pload.ActiveStream(**self._payload_active_stream()),
		)

	def _do_pause_change(self) -> None:
		MainSettings.paused = not MainSettings.paused
		event.publish(event.PauseChange, MainSettings.paused)
		log.info(f'Paused set to {MainSettings.paused}')

	def _do_menu_value_change(self, direction: ChangeDirection) -> None:
		with self._lock:
			if not self._menu:
				log.warning('No menu configured, cannot change menu value', extra={'direction': direction})
				return
			if self._menu_is(MenuName.STREAMS):
				if time.time() - self._stream_change_time < Config.change_stream_debounce_sec:
					log.warning('Stream change debounced, ignoring menu value change', extra={'direction': direction})
					return
				MainSettings.stream_index = _shift_index(self.stream_index, direction, self.visible_streams)
				event.publish(event.ActiveStreamChange, **self._payload_active_stream())
				self._stream_change_time = time.time()
				log.info(f'Set stream index:{self.stream_index}')
			elif self._menu_is(MenuName.BRIGHTNESS, MenuName.CONTRAST):
				new_value = self.stream.update_brightness(direction) if self._menu_is(MenuName.BRIGHTNESS) else self.stream.update_contrast(direction)
				prop = self._menu.name.to_prop()
				event.publish(
					event.StreamBalanceChange,
					index=self.stream_index,
					name=self.stream.name,
					prop=prop, # type: ignore
					value=new_value,
				)
				log.info(f'Changed {prop} to {new_value}')
			event.publish(event.AnyActiveChange, self._payload_active_all())

	def _do_menu_index_change(self, _direction: ChangeDirection) -> None:
		event.publish(event.AnyActiveChange, self._payload_active_all())

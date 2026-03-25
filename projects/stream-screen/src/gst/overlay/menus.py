from abc import ABC, abstractmethod
from typing import ClassVar

from gst.lib import CairoImageSurface
from gst.overlay.color import Color
from gst.overlay.overlay import Overlay
import event
from shared import MenuName
from config import Config, StreamConfig


class _Menu(Overlay):
	MENU_NAME: ClassVar[MenuName]

	def __init__(self, menu_name: MenuName | None, stream_index: int, confs: list[StreamConfig]):
		super().__init__()
		self.menu_name = menu_name
		self.stream_index = stream_index
		self.streams = list(confs)
		self.setup()
		if menu_name == self.MENU_NAME:
			self.show()
		event.subscribe(event.ActiveMenuChange, self.on_menu_change)
		event.subscribe(event.ActiveStreamChange, self.on_stream_change)

	def setup(self): ...

	def show(self):
		raise NotImplementedError

	def hide(self):
		with self.draw_context():
			pass

	def on_menu_change(self, pl: event.pload.ActiveMenu):
		self.menu_name = pl.name
		if self.menu_name == self.MENU_NAME:
			self.show()
		else:
			self.hide()

	def on_stream_change(self, pl: event.pload.ActiveStream):
		self.stream_index = pl.index
		if self.menu_name == self.MENU_NAME:
			self.show()


class MenuStreams(_Menu):
	MENU_NAME = MenuName.STREAMS

	def setup(self):
		self.stream_names = [s.abbreviation for s in self.streams]
		self.surfaces: list[CairoImageSurface] = [self.render(i) for i in range(len(self.streams))]

	def show(self):
		with self.draw_context():
			self.build_cr.set_source_surface(self.surfaces[self.stream_index], 0, 0)
			self.build_cr.paint()

	def render(self, active_index: int) -> CairoImageSurface:
		with self.render_context() as result:
			color = Color.WHITE
			x = 10
			y = Config.screen_height - 10
			for i, s in enumerate(self.stream_names):
				alpha = 1.0
				font_size = 30 if i == active_index else 20
				bg_padding = 5

				self.set_properties(font_size=font_size)
				extents = self.build_cr.text_extents(s)
				self.set_properties(color=Color.BLACK, alpha=1.0, font_size=font_size)
				self.background(extents, x, y, padding=bg_padding)
				self.set_properties(color=color, alpha=alpha, font_size=font_size)
				self.build_cr.move_to(x, y)
				self.build_cr.show_text(s)
				x += extents.width + 1 + (bg_padding * 2)
		return result.surface


class _BalanceMenu(ABC, _Menu):
	def __init__(self, menu_name: MenuName | None, stream_index: int, confs: list[StreamConfig]):
		super().__init__(menu_name, stream_index, confs)
		event.subscribe(event.StreamBalanceChange, self.on_balance_change)

	def on_balance_change(self, _pl):
		if self.menu_name == self.MENU_NAME:
			self.show()

	@abstractmethod
	def get_value(self) -> int: ...

	def show(self):
		text = f'{self.MENU_NAME}: {self.get_value()}%'
		with self.draw_context():
			self.set_properties(color=Color.RED, alpha=1.0, font_size=20)
			extents = self.build_cr.text_extents(text)
			x = 10
			y = Config.screen_height - extents.height
			self.set_properties(color=Color.WHITE, alpha=0.75)
			self.background(extents, x, y, padding=5)
			self.build_cr.move_to(x, y)
			self.build_cr.show_text(text)


class MenuBrightness(_BalanceMenu):
	MENU_NAME = MenuName.BRIGHTNESS

	def get_value(self) -> int:
		return self.streams[self.stream_index].brightness_percent()


class MenuContrast(_BalanceMenu):
	MENU_NAME = MenuName.CONTRAST

	def get_value(self) -> int:
		return self.streams[self.stream_index].contrast_percent()

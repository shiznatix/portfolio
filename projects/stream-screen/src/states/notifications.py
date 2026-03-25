from dataclasses import dataclass
import threading

import rhpy
import event
from templates import TemplateParser, Parts
from config import Config, NotificationConfig

class Notification:
	@dataclass
	class Timers:
		blink: rhpy.Timer
		remove: rhpy.Timer
		timeout: rhpy.Timer

		def cancel_all(self):
			self.blink.cancel()
			self.remove.cancel()
			self.timeout.cancel()

	class Template():
		@dataclass
		class Props:
			visible: bool
			parts: Parts
			def __iter__(self):
				return iter(self.parts)

		@property
		def props(self) -> Props:
			return self.Props(visible=self.visible, parts=self.parts)

		def __init__(self, conf: NotificationConfig.TemplateConfig):
			self.visible = True
			self.blink = conf.blink
			self.template = conf.template
			self.template_vars = conf.template_vars or {}
			self.parser = TemplateParser(conf.template, **self.template_vars)
			self.parts = self.parser.format()

	@property
	def active(self):
		with self._lock:
			return self._template is not None

	@property
	def props(self):
		with self._lock:
			return self._template.props if self._template else None

	def __init__(self, conf: NotificationConfig):
		self._lock = threading.RLock()
		self.log = rhpy.logs(f'state.notif.{conf.name}')
		self.name = conf.name
		self._conf = conf
		self._no_value_template = self.Template(conf.no_value_config) if conf.no_value_config else None
		self._value_template = self.Template(conf.value_config) if conf.value_config else None
		self._timeout_template = self.Template(conf.timeout_config) if conf.timeout_config else None
		self._template = self._no_value_template
		self._timers = self.Timers(
			blink=rhpy.timer(f'blink.{self.name}', 1.0, self._on_blink, False),
			remove=rhpy.timer(f'remove.{self.name}', conf.remove_after_sec, self._on_remove, False),
			timeout=rhpy.timer(f'timeout.{self.name}', conf.timeout_after_sec, self._on_timed_out, False),
		)
		self._event_debug_key = f'notif.{self.name}'
		self._last_value = None

		if self._value_template:
			event.subscribe(event.RequestNotificationValueChange, self._on_value, name=self.name, debug_key=self._event_debug_key)
		event.subscribe(event.RequestNotificationRemove, self._on_remove, self.name, debug_key=self._event_debug_key)

	def _emit_change(self):
		event.publish(event.AnyNotificationChange, debug_key=self._event_debug_key)

	def _on_blink(self):
		with self._lock:
			if self._template and self._template.blink:
				self._template.visible = not self._template.visible
				self._emit_change()

	def _on_timed_out(self):
		with self._lock:
			self._timers.timeout.cancel()
			if self._template == self._timeout_template:
				return
			self._template = self._timeout_template
			self._emit_change()
			self.log.info(f'Notification "{self.name}" timed out')

	def _on_remove(self):
		with self._lock:
			self._timers.cancel_all()
			if self._template == self._no_value_template:
				return
			self._template = self._no_value_template
			self._emit_change()
			self.log.info(f'Notification "{self.name}" removed')

	def _on_value(self, pl: event.pload.NotificationValue):
		with self._lock:
			self._timers.remove.restart(quiet=True)
			self._timers.timeout.restart(quiet=True)

			tmpl = self._value_template
			if not tmpl:
				return

			parser = tmpl.parser
			value_changed = pl.value != self._last_value
			parts = tmpl.parts
			if value_changed:
				try:
					parts = parser.format(**pl.value) if isinstance(pl.value, dict) else parser.format(value=pl.value)
				except: ...

			blink = tmpl.blink if isinstance(tmpl.blink, bool) else rhpy.matches_schema(pl.value, tmpl.blink)
			blink = blink if isinstance(blink, bool) else blink[0]
			visible = tmpl.visible if blink else True
			visible_changed = tmpl.visible != visible

			template_changed = self._template != tmpl

			has_change = value_changed or visible_changed or template_changed
			tmpl.parts = parts
			tmpl.blink = blink
			tmpl.visible = visible
			self._template = tmpl
			self._last_value = pl.value

			if has_change:
				self._emit_change()

			if blink:
				self._timers.blink.start(quiet=True)
			elif self._timers.blink.is_active():
				self._timers.blink.cancel()

class Notifications:
	def __init__(self):
		self._notifs = [ Notification(c) for c in Config.notifications ]
		rhpy.on_quit(self.cleanup)

	def props(self):
		return [ n.props for n in self._notifs if n.props ]

	def cleanup(self):
		self._notifs = []

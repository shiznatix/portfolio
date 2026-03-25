from __future__ import annotations
import glob
from typing import Literal, Union
from pydantic import field_validator, model_validator

import rhpy

from shared import ChangeDirection, MenuName


class RedisEventsConfig(rhpy.Model):
	url: str
	channels: list[str] = ['*']


BRIGHT_MIN = -1.0
BRIGHT_MAX = 1.0
CONTRAST_MIN = 0.0
CONTRAST_MAX = 2.0
class StreamSettings(rhpy.Settings):
	brightness: float = 0.0
	contrast: float = 1.0

	@field_validator('brightness', mode='before')
	@classmethod
	def clamp_brightness(cls, val: float) -> float:
		return round(max(BRIGHT_MIN, min(BRIGHT_MAX, val)), 1)

	@field_validator('contrast', mode='before')
	@classmethod
	def clamp_contrast(cls, val: float) -> float:
		return round(max(CONTRAST_MIN, min(CONTRAST_MAX, val)), 1)

	def brightness_percent(self) -> int:
		return int((self.brightness - BRIGHT_MIN) / (BRIGHT_MAX - BRIGHT_MIN) * 100)

	def contrast_percent(self) -> int:
		return int((self.contrast - CONTRAST_MIN) / (CONTRAST_MAX - CONTRAST_MIN) * 100)

class StreamConfig(rhpy.Model):
	name: str
	url: str
	encoding: Literal['h264', 'jpeg'] = 'h264'
	abbreviation: str = ''
	overlays: bool = True
	rotate: int = 0
	visible: bool = True # TODO - doesn't do anything really, probably needed for split screen...
	alert_schema: dict | None = rhpy.preserve_keys(None) # TODO - not implemented
	alert_timeout_sec: int | None = None # TODO - not implemented
	connect_on_start: bool = False
	reconnect_on_error: Literal['always', 'when-visible'] = 'when-visible' # TODO - not implemented
	stay_connected: bool = False # TODO - not implemented
	stay_connected_sec: int | None = None # TODO - not implemented
	detections_source: RedisEventsConfig | None = None
	_settings: StreamSettings

	@property
	def brightness(self) -> float:
		return self._settings.brightness
	@brightness.setter
	def brightness(self, value: float):
		self._settings.brightness = value
	@property
	def contrast(self) -> float:
		return self._settings.contrast
	@contrast.setter
	def contrast(self, value: float):
		self._settings.contrast = value

	@model_validator(mode='after')
	def _load_settings_and_defaults(self) -> StreamConfig:
		if not self.abbreviation:
			self.abbreviation = self.name[:2].upper()
		self._settings = StreamSettings(name=self.name)
		return self

	def update_brightness(self, direction: ChangeDirection):
		self.brightness = self.brightness + (0.1 if direction == ChangeDirection.INC else -0.1)
		return self.brightness

	def update_contrast(self, direction: ChangeDirection):
		self.contrast = self.contrast + (0.1 if direction == ChangeDirection.INC else -0.1)
		return self.contrast

	def brightness_percent(self) -> int:
		return self._settings.brightness_percent()

	def contrast_percent(self) -> int:
		return self._settings.contrast_percent()


class NotificationConfig(rhpy.Model):
	class TemplateConfig(rhpy.Model):
		template: str
		template_vars: dict | None = rhpy.preserve_keys(None)
		blink: Union[bool, dict] = rhpy.preserve_keys(False)

	name: str
	# when no value is set
	no_value_template: str | None = None
	no_value_blink: Union[bool, dict] = rhpy.preserve_keys(False)
	no_value_config: TemplateConfig | None = None
	# when a value exists
	value_schema: dict | None = rhpy.preserve_keys(None)
	value_template: str | None = None
	value_template_vars: dict | None = rhpy.preserve_keys(None)
	value_blink: Union[bool, dict] = rhpy.preserve_keys(False)
	value_config: TemplateConfig | None = None
	# when to unset the value
	remove_schema: dict | None = rhpy.preserve_keys(None)
	remove_after_sec: int | None = None
	# when no data is received for this many seconds
	timeout_after_sec: int | None = None
	timeout_template: str | None = None
	timeout_blink: Union[bool, dict] = rhpy.preserve_keys(False)
	timeout_config: TemplateConfig | None = None

	@model_validator(mode='after')
	def _build_template_configs(self) -> NotificationConfig:
		if self.no_value_template:
			self.no_value_config = self.TemplateConfig.model_validate({
				'template': self.no_value_template,
				'template_vars': None,
				'blink': self.no_value_blink,
			})
		if self.value_template:
			self.value_config = self.TemplateConfig.model_validate({
				'template': self.value_template,
				'template_vars': self.value_template_vars,
				'blink': self.value_blink,
			})
		if self.timeout_template:
			self.timeout_config = self.TemplateConfig.model_validate({
				'template': self.timeout_template,
				'template_vars': None,
				'blink': self.timeout_blink,
			})
		return self


class _Config(rhpy.Config):
	screen_type: Literal['framebuffer', 'kms', 'st7789'] = 'framebuffer'
	screen_width: int = 0
	screen_height: int = 0
	screen_rotate: int = 0
	screen_fps: int = 10
	splash_rotate: int = 0
	overlay_rotate: int = 0
	display_device: str | None = None
	display_driver: str | None = None
	redis_events: list[RedisEventsConfig] = []
	pause_stream_schema: dict | None = rhpy.preserve_keys(None)
	increment_menu_schema: dict | None = rhpy.preserve_keys(None)
	decrement_menu_schema: dict | None = rhpy.preserve_keys(None)
	increment_value_schema: dict | None = rhpy.preserve_keys(None)
	decrement_value_schema: dict | None = rhpy.preserve_keys(None)
	change_stream_debounce_sec: float = 0.5
	font_size_scale: float = 1.0
	streams: list[StreamConfig] = []
	menus: list[MenuName] = []
	notifications: list[NotificationConfig] = []

	@field_validator('display_device', mode='after')
	@classmethod
	def _resolve_display_device(cls, value: str | None) -> str | None:
		if isinstance(value, str) and value.endswith('*'):
			matches = glob.glob(value)
			if matches:
				return matches[0]
			raise ValueError(f'No devices found matching pattern: {value}')
		return value

	@model_validator(mode='after')
	def _build_menus_and_load_settings(self) -> _Config:
		# only show menus if we can change something
		if self.increment_value_schema and self.decrement_value_schema:
			menus: list[MenuName] = []
			if len(self.streams) > 1:
				menus.append(MenuName.STREAMS)
			menus.append(MenuName.BRIGHTNESS)
			menus.append(MenuName.CONTRAST)
			self.menus = menus
		return self

	def print_all_dump(self):
		data = super().print_all_dump()
		data['notifications'] = len(self.notifications)
		return data

	def get_stream_by_name(self, name: str) -> StreamConfig | None:
		for stream in self.streams:
			if stream.name == name:
				return stream
		return None
Config = _Config()


class _MainSettings(rhpy.Settings):
	stream_index: int = 0
	paused: bool = False

	@field_validator('stream_index', mode='before')
	@classmethod
	def clamp_stream_index(cls, val: int) -> int:
		return max(0, min(val, len(Config.streams) - 1))
MainSettings = _MainSettings(name='main')

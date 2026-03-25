
from __future__ import annotations
from typing import Annotated, Literal

from pydantic import Field, model_validator

import rhpy

class SourceConfig(rhpy.Model):
	match_schema: dict = rhpy.preserve_keys()

class PixelsConfig(rhpy.Model):
	class AnimationStatic(rhpy.Model):
		type: Literal['static']
		color: rhpy.rgb.Color
		brightness: float | int
	class AnimationBlink(rhpy.Model):
		type: Literal['blink']
		colors: list[rhpy.rgb.Color]
		brightness: float | int
		delay_sec: float | int
	class AnimationDayFade(rhpy.Model):
		class TimeBlock(rhpy.Model):
			duration_sec: float | int
			start_color: rhpy.rgb.Color
			end_color: rhpy.rgb.Color
			start_brightness: float | int = 1.0
			end_brightness: float | int = 1.0

		type: Literal['day-fade']
		time_blocks: list[TimeBlock]
	type Animation = Annotated[AnimationStatic | AnimationBlink | AnimationDayFade, Field(discriminator='type')]

	class SourceDisableSources(SourceConfig):
		type: Literal['disable-sources']
		disable_sources: list[str]
	class SourceInverseAmbientBrightness(SourceConfig):
		type: Literal['inverse-ambient-brightness']
		off_above_value: float = 1.0
		min_value: float = 0.0
		max_value: float = 1.0
	class SourceMatchAmbientBrightness(SourceConfig):
		type: Literal['match-ambient-brightness']
		off_above_value: float = 1.0
		off_below_value: float = 0
		min_value: float = 0.0
		max_value: float = 1.0
	class SourceChangeBrightness(SourceConfig):
		type: Literal['change-brightness']
		step: float | int = 0.1
		min_value: float = 0.0
		max_value: float = 1.0
	class SourceCycleAnimations(SourceConfig):
		type: Literal['cycle-animations']
		animations: list[PixelsConfig.Animation]
	class SourceLockAnimation(SourceConfig):
		type: Literal['lock-animation']
		animation: PixelsConfig.Animation | None
	type Source = Annotated[
		SourceDisableSources
		| SourceInverseAmbientBrightness
		| SourceMatchAmbientBrightness
		| SourceChangeBrightness
		| SourceCycleAnimations
		| SourceLockAnimation,
		Field(discriminator='type')
	]

	name: str
	type: Literal['dotstar', 'neopixel']
	gpio_data: int
	gpio_clock: int | None = None
	prometheus_title: str
	count: int
	max_brightness: float | int = 1.0
	pixels_on_fraction: int = 1
	default_animation: Animation
	sources: list[Source]

class  LedConfig(rhpy.Model):
	class Source(SourceConfig):
		on_secs: int | float
		off_secs: int | float
		repeat: int = 0

	name: str
	prometheus_title: str
	gpio: int
	sources: list[Source]

class CameraStreamConfig(rhpy.Model):
	class Source(SourceConfig):
		pass

	name: str
	prometheus_title: str
	rtsp_url: str
	buffer_secs: int | float
	record_secs: int
	framerate: int
	extract_frames: bool = False
	recordings_path: str
	recordings_owner: str | None = None
	recordings_max_age_secs: int | None = None
	receiver_urls: list[str] = []
	sources: list[Source]

class BuzzerConfig(rhpy.Model):
	class Source(SourceConfig):
		repeat: int = 0
		repeat_delay_sec: int | float = 0
		melody: list[tuple[str | bool, float | int]]

	name: str
	prometheus_title: str
	gpio: int
	cooldown_sec: int | float = 3
	double_cooldown_sec: int | float | None = None
	sources: list[Source]

class OledConfig(rhpy.Model):
	class Screen(rhpy.Model):
		class Box(rhpy.Model):
			class Text(rhpy.Model):
				match_schema: dict | None = rhpy.preserve_keys(None)
				template: str | None = None
				text: str = 'N/R'
				value_round_decimal: int | None = None
				font_size: int = 1
				stroke_width: int = 0
			class Image(rhpy.Model):
				file_name: str
				width: int | None = None
				height: int | None = None
			class Animate(rhpy.Model):
				type: Literal['swim-left-right', 'scroll-left-right']
				pixel_jump_x: int = 0
				pixel_jump_y: int = 0

			x: int
			y: int
			width: int
			height: int
			animate: Animate | None = None
			halign: Literal['left', 'center', 'right'] | None = None
			valign: Literal['top', 'center', 'bottom'] | None = None
			hflip: bool = False
			vflip: bool = False
			image: Image | None = None
			text: Text | None = None

		display_secs: int | float
		background: str = 'black'
		border: str | None = None
		boxes: list[Box]

	name: str
	device: Literal['ssd1306', 'sh1106']
	width: int
	height: int
	rotate: int = 0
	i2c_port: int = 1
	screens: list[Screen]

class ReceiverConfig(rhpy.Model):
	buzzers: dict[str, BuzzerConfig] | None = None
	leds: dict[str, LedConfig] | None = None
	pixels: dict[str, PixelsConfig] | None = None
	oled_displays: dict[str, OledConfig] | None = None
	camera_streams: dict[str, CameraStreamConfig] | None = None

	@model_validator(mode='wrap')
	@classmethod
	def set_receiver_names(cls, value, handler):
		receivers: list[str] = [c for c in ['buzzers', 'leds', 'pixels', 'oled_displays', 'camera_streams'] if c in value and value[c]]
		for key in receivers:
			for name, data in value[key].items():
				if isinstance(data, dict):
					data['name'] = name
					data['prometheus_title'] = data.get('prometheus_title', name)
		return handler(value)

class _Config(rhpy.Config):
	receivers: ReceiverConfig
Config = _Config()

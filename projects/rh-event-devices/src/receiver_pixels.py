from __future__ import annotations
import threading
import time
import logging
import abc

from pydantic import PrivateAttr

import adafruit_dotstar
try:
	import neopixel
except ImportError:
	neopixel = None

import rhpy
from rhpy import matches_sensor_schema
from receiver import Receiver
from prometheus import gauge_brightness
from config import PixelsConfig

def _animation_for_model(model, pixel_count: int):
	if isinstance(model, PixelsConfig.AnimationDayFade):
		return AnimationFadeThroughDay(pixel_count=pixel_count, model=model)
	elif isinstance(model, PixelsConfig.AnimationStatic):
		return AnimationStatic(pixel_count=pixel_count, model=model)
	elif isinstance(model, PixelsConfig.AnimationBlink):
		return AnimationBlink(pixel_count=pixel_count, model=model)
	else:
		raise ValueError(f'Unknown animation model: {model}')

class SourceReceiveResult:
	def __init__(
		self,
		*,
		disable_sources: list[str] | None = None,
		brightness: float | None = None,
		animation = None,
		animation_locked: bool | None = None,
	):
		self.disable_sources: list[str] | None = disable_sources
		self.brightness: float | None = brightness
		self.animation: Animation | None = animation
		self.animation_locked: bool | None = animation_locked

class PixelsSource(abc.ABC):
	def __init__(self, model, *, kind: str):
		self.match_schema = model.match_schema
		self.log = rhpy.logs(f'pixsource-{kind}')

	@abc.abstractmethod
	def receive(self, *, value, current_brightness: float) -> SourceReceiveResult:
		pass

class SourceDisableSources(PixelsSource):
	KIND = 'disable-sources'

	def __init__(self, *, model: PixelsConfig.SourceDisableSources):
		super().__init__(model, kind=self.KIND)
		self.disable_sources: list[str] = model.disable_sources

	def receive(self, *, value, current_brightness: float) -> SourceReceiveResult:
		return SourceReceiveResult(
			disable_sources=self.disable_sources,
		)

class SourceLockAnimation(PixelsSource):
	KIND = 'lock-animation'

	def __init__(self, *, pixel_count: int, model: PixelsConfig.SourceLockAnimation):
		super().__init__(model, kind=self.KIND)
		self.animation = _animation_for_model(model.animation, pixel_count) if model.animation else None

	def receive(self, *, value, current_brightness: float) -> SourceReceiveResult:
		return SourceReceiveResult(animation=self.animation, animation_locked=bool(self.animation))

class SourceInverseBrightnessValue(PixelsSource):
	KIND = 'inverse-ambient-brightness'

	def __init__(self, *, model: PixelsConfig.SourceInverseAmbientBrightness):
		super().__init__(model, kind=self.KIND)
		self.off_above_value: float = model.off_above_value
		self.min_value: float = model.min_value
		self.max_value: float = model.max_value

	def receive(self, *, value, current_brightness: float) -> SourceReceiveResult:
		value = value.get('brightness', value.get('value', 0.0)) if isinstance(value, dict) else value
		brightness = 0.0

		if value < self.off_above_value:
			# `value` is light percent, and the inversion is the brightness value of the lights
			inverted_value = min(1, max(0, 1 - value))
			if inverted_value <= 0:
				brightness = 0.0
			else:
				brightness = round(inverted_value, 2)
				brightness = min(max(self.min_value, float(brightness)), self.max_value)

		return SourceReceiveResult(brightness=brightness)

class SourceMatchBrightnessValue(PixelsSource):
	KIND = 'match-ambient-brightness'

	def __init__(self, *, model: PixelsConfig.SourceMatchAmbientBrightness):
		super().__init__(model, kind=self.KIND)
		self.off_above_value: float = model.off_above_value
		self.off_below_value: float = model.off_below_value
		self.min_value: float = model.min_value
		self.max_value: float = model.max_value

	def receive(self, *, value, current_brightness: float) -> SourceReceiveResult:
		value = value.get('brightness', value.get('value', 0.0)) if isinstance(value, dict) else value
		value = min(self.max_value, max(self.min_value, float(value)))
		brightness = (value - self.min_value) / (self.max_value - self.min_value)
		brightness = min(1.0, max(0.0, brightness))
		brightness = round(brightness, 2)

		if value >= self.off_above_value or value <= self.off_below_value:
			brightness = 0.0

		return SourceReceiveResult(brightness=brightness)

class SourceChangeBrightness(PixelsSource):
	KIND = 'change-brightness'

	def __init__(self, *, model: PixelsConfig.SourceChangeBrightness):
		super().__init__(model, kind=self.KIND)
		self.step: float | int = model.step

	def receive(self, *, value, current_brightness: float) -> SourceReceiveResult:
		direction = value.get('direction') if isinstance(value, dict) else None
		brightness = current_brightness

		if direction == 'cw' or direction == 'ccw':
			brightness = brightness + (self.step if direction == 'cw' else -self.step)
		else:
			value = value.get('value', 0.0) if isinstance(value, dict) else value
			brightness = min(1.0, max(0.0, (value + 1) / 2))

		brightness = round(brightness, 2)
		return SourceReceiveResult(brightness=brightness)

class SourceCycleAnimations(PixelsSource):
	KIND = 'cycle-animations'

	def __init__(self, *, pixel_count: int, default_animation, model: PixelsConfig.SourceCycleAnimations):
		super().__init__(model, kind=self.KIND)
		self.pixel_count: int = pixel_count
		self.default_animation: Animation = default_animation

		self.animations: list[Animation] = [_animation_for_model(anim_model, pixel_count) for anim_model in model.animations]
		self.current_index: int = -1

	def receive(self, *, value, current_brightness: float) -> SourceReceiveResult:
		animation: Animation | None = None
		self.current_index += 1

		if self.current_index >= len(self.animations):
			self.log.info('Animation cycle finished, resetting to default animation')
			self.current_index = -1
			animation = self.default_animation
		else:
			animation = self.animations[self.current_index]

		brightness = animation.default_brightness if animation.default_brightness is not None else animation.brightness
		return SourceReceiveResult(animation=animation, brightness=brightness)

class Animation:
	def __init__(self, *, kind: str, pixel_count: int):
		self.kind: str = kind
		self.pixel_count: int = pixel_count
		self.pixels: list[rhpy.rgb.Color] = [rhpy.rgb.BLACK] * pixel_count
		self.default_brightness: float | None = None
		self.brightness: float = self.default_brightness if self.default_brightness is not None else 0.0
		self.log = rhpy.logs(f'pixanim-{kind}')
		self.log.manager.disable = logging.DEBUG  # Disable debug logging by default

	def set_pixels_color(self, *, color: rhpy.rgb.Color):
		self.pixels = [color] * self.pixel_count

	def receive(self, result: SourceReceiveResult | None = None):
		pass

	def tick(self):
		pass

class AnimationStatic(Animation):
	KIND = 'static'

	def __init__(self, *, pixel_count: int, model: PixelsConfig.AnimationStatic):
		super().__init__(kind=self.KIND, pixel_count=pixel_count)
		self.color: rhpy.rgb.Color = model.color
		self.default_brightness: float = model.brightness
		self.brightness = self.default_brightness
		self.pixels = [self.color] * pixel_count

		rhpy.print_pretty(f'pixels-animation-{self.KIND}', {'color': self.color, 'brightness': self.brightness}, one_line=True)

	def receive(self, result: SourceReceiveResult | None = None):
		if not result:
			return
		current_brightness = self.brightness
		self.brightness = result.brightness if result.brightness is not None else self.brightness

		if current_brightness != self.brightness:
			self.log.info(f'New brightness: {current_brightness:.2f} to {self.brightness:.2f}')

class AnimationBlink(Animation):
	KIND = 'blink'

	def __init__(self, *, pixel_count: int, model: PixelsConfig.AnimationBlink):
		super().__init__(kind=self.KIND, pixel_count=pixel_count)
		self.colors: list[rhpy.rgb.Color] = model.colors
		self.current_color_index = 0
		self.default_brightness: float = model.brightness
		self.brightness = self.default_brightness
		self.last_change_time = time.time()
		self.delay_sec: float = model.delay_sec
		self.pixels = [self.colors[0]] * pixel_count

	def receive(self, result: SourceReceiveResult | None = None):
		if not result:
			return
		current_brightness = self.brightness
		self.brightness = result.brightness if result.brightness is not None else self.brightness

		if current_brightness != self.brightness:
			self.log.info(f'New brightness: {current_brightness:.2f} to {self.brightness:.2f}')

	def tick(self):
		color = self.colors[self.current_color_index]
		self.set_pixels_color(color=color)

		if time.time() - self.last_change_time >= self.delay_sec:
			self.current_color_index = (self.current_color_index + 1) % len(self.colors)
			self.last_change_time = time.time()
			self.log.debug(f'Tick {self.current_color_index} {self.pixels[0]} {self.brightness}')

class AnimationFadeThroughDay(Animation):
	KIND = 'day-fade'

	class TimeBlock:
		def __init__(self, *, model: PixelsConfig.AnimationDayFade.TimeBlock, start_sec: int):
			self.start_sec: int = start_sec
			self.end_sec: int = int(min(start_sec + model.duration_sec, 86400))
			self.start_color: rhpy.rgb.Color = model.start_color
			self.end_color: rhpy.rgb.Color = model.end_color
			self.start_brightness: float = model.start_brightness
			self.end_brightness: float = model.end_brightness

		def to_string(self):
			return f'{self.start_sec}->{self.end_sec}{self.start_color}->{self.end_color}->{self.start_brightness}->{self.end_brightness}'

	def __init__(self, *, pixel_count: int, model: PixelsConfig.AnimationDayFade):
		super().__init__(kind=self.KIND, pixel_count=pixel_count)
		self.current_time_block: AnimationFadeThroughDay.TimeBlock | None = None
		self.time_blocks: list[AnimationFadeThroughDay.TimeBlock] = []
		self.color: rhpy.rgb.Color = rhpy.rgb.BLACK
		self.brightness = 0.0

		start_sec: int = 0
		for tb_model in model.time_blocks:
			time_block = AnimationFadeThroughDay.TimeBlock(model=tb_model, start_sec=start_sec)
			start_sec = time_block.end_sec
			self.time_blocks.append(time_block)

		rhpy.print_pretty(f'pixels-animation-{self.KIND}', [self.time_blocks[i].to_string() for i in range(len(self.time_blocks))])

	# changing the brightness from a receiver is odd and will just get reset on next `tick`
	# def receive(self, result: SourceReceiveResult):
	# 	current_brightness = self.brightness
	# 	self.brightness = result.brightness if result.brightness is not None else self.brightness

	# 	if current_brightness != self.brightness:
	# 		self.log.info(f'New brightness: {current_brightness:.2f} to {self.brightness:.2f}')

	def tick(self):
		current_sec = rhpy.second_of_day()
		current_time_block = self.current_time_block
		current_color = self.color

		if self.current_time_block is None or current_sec >= self.current_time_block.end_sec:
			self.current_time_block = None

			for time_block in self.time_blocks:
				if time_block.start_sec <= current_sec < time_block.end_sec:
					self.current_time_block = time_block
					self.log.info(f'New time block: {time_block.to_string()}')
					break

			if current_time_block != self.current_time_block and self.current_time_block is None:
				self.log.info(f'No time block found for {current_sec}')

		if self.current_time_block is None:
			self.color = rhpy.rgb.BLACK
		else:
			# calculate the current color based on the time block
			# the color is a mix of the start and end colors based on the current time
			start_sec = self.current_time_block.start_sec
			end_sec = self.current_time_block.end_sec
			start_color = self.current_time_block.start_color
			end_color = self.current_time_block.end_color
			start_brightness = self.current_time_block.start_brightness
			end_brightness = self.current_time_block.end_brightness
			percent = (current_sec - start_sec) / (end_sec - start_sec)
			self.color = (
				int(start_color[0] + (end_color[0] - start_color[0]) * percent),
				int(start_color[1] + (end_color[1] - start_color[1]) * percent),
				int(start_color[2] + (end_color[2] - start_color[2]) * percent),
			)
			self.brightness = round(start_brightness + (end_brightness - start_brightness) * percent, 2)
			self.log.debug(f'Tick {current_sec}{self.color}{self.brightness:2f} {(percent*100):.2f}% [{self.current_time_block.to_string()}]')

		self.set_pixels_color(color=self.color)

		if current_color != self.color:
			self.log.info(f'New color: {current_color} to {self.color}')

class Pixels(PixelsConfig, Receiver):
	_pixels: adafruit_dotstar.DotStar | neopixel.NeoPixel  # type: ignore
	_animation: Animation
	_animation_lock: threading.RLock = PrivateAttr(default_factory=threading.RLock)
	_disabled_source_names: list[str] = []
	_animation_locked: bool = False
	_pixels_on_offset: int = 0
	_pixel_sources: list[PixelsSource] = []

	def init_receiver(self):
		self._animation = _animation_for_model(self.default_animation, self.count)
		self._pixel_sources = []
		for source in self.sources:
			if isinstance(source, PixelsConfig.SourceDisableSources):
				self._pixel_sources.append(SourceDisableSources(model=source))
			elif isinstance(source, PixelsConfig.SourceLockAnimation):
				self._pixel_sources.append(SourceLockAnimation(pixel_count=self.count, model=source))
			elif isinstance(source, PixelsConfig.SourceInverseAmbientBrightness):
				self._pixel_sources.append(SourceInverseBrightnessValue(model=source))
			elif isinstance(source, PixelsConfig.SourceMatchAmbientBrightness):
				self._pixel_sources.append(SourceMatchBrightnessValue(model=source))
			elif isinstance(source, PixelsConfig.SourceChangeBrightness):
				self._pixel_sources.append(SourceChangeBrightness(model=source))
			elif isinstance(source, PixelsConfig.SourceCycleAnimations):
				self._pixel_sources.append(SourceCycleAnimations(pixel_count=self.count, default_animation=self._animation, model=source))
			else:
				raise ValueError(f'Unknown pixels source kind: {source}')

		if self.type == 'dotstar':
			if not self.gpio_clock:
				raise ValueError('gpio_clock is required for dotstar pixels')
			self._pixels = adafruit_dotstar.DotStar(
				rhpy.pin(self.gpio_clock),
				rhpy.pin(self.gpio_data),
				self.count,
				brightness=0,
			)
		elif self.type == 'neopixel':
			self._pixels = neopixel.NeoPixel( # type: ignore
				rhpy.pin(self.gpio_data),
				self.count,
				brightness=0,
				auto_write=False,
			)
		else:
			raise ValueError(f'Invalid pixel kind: {self.type}')

		self.write_animation()

	def write_animation(self):
		# if self._animation.brightness > self.max_brightness:
		# 	self.log.warning(f'Animation brightness {self._animation.brightness} exceeds max brightness {self.max_brightness}, limiting to max')
		self._pixels.brightness = min(self._animation.brightness, self.max_brightness)

		if self.pixels_on_fraction > 1:
			self._pixels_on_offset = (self._pixels_on_offset + 1) % self.pixels_on_fraction

		for i in range(self.count):
			if self.pixels_on_fraction == 1:
				# All pixels on
				self._pixels[i] = self._animation.pixels[i]
			else:
				# Only light pixels where (i % self.pixels_on_fraction) == self._pixels_on_offset
				if i % self.pixels_on_fraction == self._pixels_on_offset:
					self._pixels[i] = self._animation.pixels[i]
				else:
					self._pixels[i] = rhpy.rgb.BLACK

		self._pixels.show()
		gauge_brightness.labels(self.name, self.prometheus_title).set(round(self._pixels.brightness * 100))

	def receive(self, data):
		source: PixelsSource | None = None
		matched_name: str = ''
		matched_value = None
		for ps in self._pixel_sources:
			matched, name, value = matches_sensor_schema(data, ps.match_schema)
			if matched:
				source = ps
				matched_name = str(name)
				matched_value = value
				break

		if not source:
			return False

		with self._animation_lock:
			if matched_name in self._disabled_source_names:
				self.log.info(f'Source {matched_name} is disabled, ignoring value {matched_value}')
				return False

			result = source.receive(value=matched_value, current_brightness=self._pixels.brightness)
			self.log.info(f'Received source {matched_name} value: {matched_value}', extra={
				'has_animation': bool(result.animation),
				'animation_locked': result.animation_locked,
				'disable_sources_len': len(result.disable_sources or []),
				'brightness': result.brightness,
			})

			if self._animation_locked and not isinstance(result.animation_locked, bool):
				self.log.warning('Ignoring result, animation locked')
				return False

			if isinstance(result.disable_sources, list) and set(result.disable_sources) != set(self._disabled_source_names):
				self._disabled_source_names = result.disable_sources
				self.log.info(f'Disabled sources: {self._disabled_source_names}')
			if result.animation and result.animation != self._animation:
				self._animation = result.animation
				self.log.info(f'New animation set: {self._animation.kind}')
			if isinstance(result.animation_locked, bool) and result.animation_locked != self._animation_locked:
				self._animation_locked = result.animation_locked
				self.log.info(f'Animation lock toggled: {self._animation_locked}')
				if not self._animation_locked:
					self._animation = _animation_for_model(self.default_animation, self.count)

			self._animation.receive(result)
			# self.write_animation()
		return True

	def run(self):
		self.log.info('Starting main function')

		last_log_time = 0
		log_every_sec = 15

		while rhpy.running():
			with self._animation_lock:
				self._animation.tick()
				self.write_animation()
				if time.time() - last_log_time > log_every_sec:
					last_log_time = time.time()
					self.log.info(f'Tick {self._animation.kind} [{self._pixels[0]},{self._pixels[1]}] {self._pixels.brightness}')
			# rhpy.wait(0.01)

	def cleanup(self):
		if self._pixels:
			self._pixels.brightness = 0.0
			self._pixels.fill(rhpy.rgb.BLACK)
			self._pixels.show()

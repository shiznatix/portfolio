import abc
from typing import Optional
import evdev
from pydantic import model_validator

import rhpy
from sensor import Sensor

class EventInputDeviceSensor(Sensor):
	device_path: str = '/dev/input/event0'
	debounce_sec: float = 0.5
	device_width: Optional[int] = None
	device_height: Optional[int] = None

	input_event_min_xy: int = 0
	input_event_max_xy: Optional[int] = None
	input_event_swap_xy: bool = False
	input_event_min_x: int = 0
	input_event_max_x: Optional[int] = None
	input_event_invert_x: bool = False
	input_event_min_y: int = 0
	input_event_max_y: Optional[int] = None
	input_event_invert_y: bool = False
	tap_max_distance: int = 30
	long_press_min_sec: float = 0.5
	swipe_min_distance: int = 100
	swipe_min_sec: float = 0.1
	swipe_max_sec: float = 0.7

	_device: evdev.InputDevice

	@model_validator(mode='after')
	def set_input_event_defaults(self):
		if self.input_event_min_x is None:
			self.input_event_min_x = self.input_event_min_xy
		if self.input_event_max_x is None:
			self.input_event_max_x = self.input_event_max_xy
		if self.input_event_min_y is None:
			self.input_event_min_y = self.input_event_min_xy
		if self.input_event_max_y is None:
			self.input_event_max_y = self.input_event_max_xy
		return self

	@abc.abstractmethod
	def get_value(self, events: list[evdev.InputEvent]) -> dict | None:
		pass

	def init_sensor(self):
		self._device = evdev.InputDevice(self.device_path)

	def cleanup(self):
		if hasattr(self, '_device'):
			self._device.close()

	def run(self):
		events: list[evdev.InputEvent] = []

		while rhpy.running():
			input_event: evdev.InputEvent = self._device.read_one()
			if input_event:
				events.append(input_event)
				if len(events) > 300:
					self.log.warning('Too many events queued, clearing')
					events = []
			elif events:
				value = self.get_value(events)
				events = []
				if value:
					self.send_value(value)
					rhpy.wait(self.debounce_sec)

			rhpy.wait(0.01)

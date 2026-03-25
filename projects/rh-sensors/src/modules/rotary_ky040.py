from typing import Literal

from prometheus import gauge_rotary_value, counter_rotary_press
from sensors.button import ButtonSensor
from sensors.rotary import RotarySensor

_MODULE = 'rotary-ky040'
MODULE_TURN = f'{_MODULE}-turn'
MODULE_PRESS = f'{_MODULE}-press'

class SensorTurn(RotarySensor):
	module: str = MODULE_TURN

	# TODO - make a config way to reset the rotary "position" on press
	def event_callback(self, direction: Literal['cw', 'ccw']):
		super().event_callback(direction)
		self.metric(gauge_rotary_value).set(self._rotary.value)

class SensorPress(ButtonSensor):
	module: str = MODULE_PRESS

	def event_callback(self):
		super().event_callback()
		self.metric(counter_rotary_press).inc()

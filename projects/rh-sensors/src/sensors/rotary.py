from typing import Literal
from gpiozero import RotaryEncoder

import rhpy
from sensor import Sensor

class RotarySensor(Sensor):
	gpio_clk: int
	gpio_dt: int
	max_steps: int = 5
	wrap: bool = False
	_rotary: RotaryEncoder

	def init_sensor(self):
		self._rotary = RotaryEncoder(self.gpio_clk, self.gpio_dt, max_steps=self.max_steps, wrap=self.wrap)
		self._rotary.when_rotated_clockwise = lambda: self.event_callback('cw')
		self._rotary.when_rotated_counter_clockwise = lambda: self.event_callback('ccw')

	def cleanup(self):
		if hasattr(self, '_rotary'):
			self._rotary.close()

	def event_callback(self, direction: Literal['cw', 'ccw']):
		value = {
			'value': rhpy.round(self._rotary.value, 2),
			'steps': self._rotary.steps,
			'direction': direction,
		}
		self.log.info('Rotation detected', extra=value)
		self.send_value(value)

	def run(self):
		while rhpy.running():
			rhpy.wait(1)

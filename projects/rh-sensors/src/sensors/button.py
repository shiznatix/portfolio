from gpiozero import Button

import rhpy
from sensors.gpio import GpioSensor

class ButtonSensor(GpioSensor):
	debounce_sec: float = 0.1
	last_value: int | None = None
	_button: Button

	def init_sensor(self):
		self.last_value = None
		self._button = Button(self.gpio, bounce_time=self.debounce_sec)
		self._button.when_activated = self.event_callback
		self._button.when_deactivated = self.event_callback

	def cleanup(self):
		if hasattr(self, '_button'):
			self._button.close()

	def get_value(self):
		return 1 if self._button.is_active else 0

	def event_callback(self):
		value = self.get_value()
		if value == self.last_value:
			return

		self.last_value = value
		self.log.info('Button detected', extra={
			'is_active': self._button.is_active,
		})
		self.send_value(value)

	def run(self):
		while rhpy.running():
			rhpy.wait(1)

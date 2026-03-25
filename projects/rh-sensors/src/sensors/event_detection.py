from gpiozero import DigitalInputDevice

import rhpy
from sensors.gpio import GpioSensor

class EventDetectionSensor(GpioSensor):
	debounce_sec: float = 0.1
	_device: DigitalInputDevice

	def init_sensor(self):
		self._device = DigitalInputDevice(self.gpio, bounce_time=self.debounce_sec)
		self._device.when_activated = self.event_callback
		self._device.when_deactivated = self.event_callback
		self._device.when_deactivated = self.deactivated_sink

	def cleanup(self):
		if hasattr(self, '_device'):
			self._device.close()

	def event_callback(self):
		self.log.info('Event detected')
		self.send_value(1)

	def deactivated_sink(self):
		self.log.info('Deactivated event detected')
		# dont do anything else yet...

	def run(self):
		while rhpy.running():
			rhpy.wait(1)

import adafruit_dht

import rhpy
from prometheus import gauge_temperature, gauge_humidity
from sensors.gpio import GpioSensor
from sensors.loop import LoopSensor

MODULE = 'thermohygrometer-am2302'

class Sensor(GpioSensor, LoopSensor):
	module: str = MODULE
	_dht: adafruit_dht.DHT22

	def init_sensor(self):
		self._dht = adafruit_dht.DHT22(rhpy.pin(self.gpio))

	def get_value(self):
		try:
			if self._dht.temperature is None or self._dht.humidity is None:
				self.log.warning(f'DHT reading missing. temperature: {self._dht.temperature}, humidity: {self._dht.humidity}')
				return None

			value = {
				'temperature': rhpy.round(self._dht.temperature, 2),
				'humidity': rhpy.round(self._dht.humidity, 2),
			}

			self.metric(gauge_temperature).set(value['temperature'])
			self.metric(gauge_humidity).set(value['humidity'])

			return value
		except (RuntimeError, TypeError) as e:
			self.log.warning(f'Failed to read value: {e}')
			return None

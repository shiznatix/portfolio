import adafruit_bme280.basic

import rhpy
import i2c_bus
from prometheus import gauge_temperature, gauge_humidity, gauge_pressure
from sensors.i2c import I2CSensor
from sensors.loop import LoopSensor

MODULE = 'barometric-bme280'

class Sensor(I2CSensor, LoopSensor):
	module: str = MODULE
	_sensor: adafruit_bme280.basic.Adafruit_BME280_I2C

	def init_sensor(self):
		i2c = i2c_bus.get(self.i2c_port)
		self._sensor = adafruit_bme280.basic.Adafruit_BME280_I2C(i2c, 0x76)

	def get_value(self):
		value = self._sensor
		value = {
			'temperature': rhpy.round(self._sensor.temperature, 1),
			'humidity': rhpy.round(self._sensor.humidity),
			'pressure': rhpy.round(self._sensor.pressure, 2),
		}

		self.metric(gauge_temperature).set(value['temperature'])
		self.metric(gauge_humidity).set(value['humidity'])
		self.metric(gauge_pressure).set(value['pressure'])

		return value

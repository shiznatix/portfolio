import i2c_bus
import adafruit_bme680

import rhpy
from prometheus import gauge_temperature, gauge_humidity, gauge_pressure, gauge_gas, gauge_altitude
from sensors.i2c import I2CSensor
from sensors.loop import LoopSensor

MODULE = 'atmosphere-bme680'

class Sensor(I2CSensor, LoopSensor):
	module: str = MODULE

	def init_sensor(self):
		super().init_sensor()
		i2c = i2c_bus.get(self.i2c_port)
		self.sensor = adafruit_bme680.Adafruit_BME680_I2C(i2c)

	def get_value(self):
		value = {
			'temperature': rhpy.round(self.sensor.temperature, 1),
			'humidity': rhpy.round(self.sensor.humidity),
			'pressure': rhpy.round(self.sensor.pressure),
			'gas': self.sensor.gas,
			'altitude': rhpy.round(self.sensor.altitude),
		}

		self.metric(gauge_temperature).set(value['temperature'])
		self.metric(gauge_humidity).set(value['humidity'])
		self.metric(gauge_pressure).set(value['pressure'])
		self.metric(gauge_gas).set(value['gas'])
		self.metric(gauge_altitude).set(value['altitude'])

		return value

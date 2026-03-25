import board
import busio
import adafruit_ina219

import rhpy
from prometheus import gauge_current, gauge_bus_voltage, gauge_shunt_voltage, gauge_battery_percent
from sensors.battery import BatterySensor

MODULE = 'battery-ina219'

class Sensor(BatterySensor):
	module: str = MODULE
	_sensor: adafruit_ina219.INA219

	def init_sensor(self):
		i2c = busio.I2C(board.SCL, board.SDA)
		self._sensor = adafruit_ina219.INA219(i2c, addr=0x43) # shows up as 0x43 on `i2cdetect -y 1`, but 0x40 is library default

	def get_value(self):
		try:
			bus_voltage = rhpy.round(self._sensor.bus_voltage, 2)
			shunt_voltage = rhpy.round(self._sensor.shunt_voltage / 1000, 2) # / 1000
			current = rhpy.round(self._sensor.current, 2)
			battery_percent = rhpy.round((bus_voltage - self.min_voltage) / (self.max_voltage - self.min_voltage) * 100)
			battery_percent = max(0, min(100, battery_percent)) # clamp to 0-100%

			value = {
				'bus_voltage': bus_voltage,
				'shunt_voltage': shunt_voltage,
				'current': current,
				'battery_percent': battery_percent,
			}

			self.metric(gauge_current).set(value['current'])
			self.metric(gauge_bus_voltage).set(value['bus_voltage'])
			self.metric(gauge_shunt_voltage).set(value['shunt_voltage'])
			self.metric(gauge_battery_percent).set(value['battery_percent'])

			return value
		except Exception as e:
			self.log.error(f'Failed to read sensor: {e}')

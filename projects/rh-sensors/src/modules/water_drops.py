from prometheus import gauge_water_drops_value, gauge_water_drops_voltage
from sensors.analog_read import AnalogReadSensor


MODULE = 'water-drops'

class Sensor(AnalogReadSensor):
	module: str = MODULE

	def get_value(self):
		value = super().get_value()
		if value is None:
			return None

		self.metric(gauge_water_drops_value).set(value['value'])
		self.metric(gauge_water_drops_voltage).set(value['voltage'])

		return value

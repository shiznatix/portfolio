from prometheus import gauge_light_value, gauge_light_voltage
from sensors.analog_read import AnalogReadSensor

MODULE = 'light-analog'

class Sensor(AnalogReadSensor):
	module: str = MODULE

	def get_value(self):
		value = super().get_value()
		if value is None:
			return None

		self.metric(gauge_light_value).set(value['value'])
		self.metric(gauge_light_voltage).set(value['voltage'])

		return value

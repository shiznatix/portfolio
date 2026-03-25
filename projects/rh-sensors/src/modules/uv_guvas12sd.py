from prometheus import gauge_uv_value, gauge_uv_voltage
from sensors.analog_read import AnalogReadSensor

MODULE = 'uv-guvas12sd'

class Sensor(AnalogReadSensor):
	module: str = MODULE

	def get_value(self):
		value = super().get_value()
		if value is None:
			return None

		self.metric(gauge_uv_value).set(value['value'])
		self.metric(gauge_uv_voltage).set(value['voltage'])

		return value

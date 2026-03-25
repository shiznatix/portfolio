from prometheus import gauge_tds_value, gauge_tds_voltage
from sensors.analog_read import AnalogReadSensor


MODULE = 'total-disolved-solids-cqrobot'

class Sensor(AnalogReadSensor):
	module: str = MODULE

	def get_value(self):
		value = super().get_value()
		if value is None:
			return None

		self.metric(gauge_tds_value).set(value['value'])
		self.metric(gauge_tds_voltage).set(value['voltage'])

		return value

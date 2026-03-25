from prometheus import gauge_soil_moisture_value, gauge_soil_moisture_voltage
from sensors.analog_read import AnalogReadSensor

MODULE = 'soil-moisture-aideepen'

class Sensor(AnalogReadSensor):
	module: str = MODULE

	def get_value(self):
		value = super().get_value()
		if value is None:
			return None

		self.metric(gauge_soil_moisture_value).set(value['value'])
		self.metric(gauge_soil_moisture_voltage).set(value['voltage'])

		return value

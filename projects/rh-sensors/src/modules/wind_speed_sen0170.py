import rhpy
from prometheus import gauge_wind_speed_meters_second, gauge_wind_speed_knots, gauge_wind_speed_value, gauge_wind_speed_voltage
from sensors.analog_read import AnalogReadSensor


MODULE = 'wind-speed-sen0170'

class Sensor(AnalogReadSensor):
	module: str = MODULE

	def get_value(self):
		value = super().get_value()
		if value is None:
			return None

		voltage = value.get('voltage', 0.0)
		analog_value = value.get('value', 0)
		value['meters_second'] = rhpy.round(6 * voltage, 2)
		value['knots'] = rhpy.round(value['meters_second'] / 1.852, 2)

		self.metric(gauge_wind_speed_meters_second).set(value['meters_second'])
		self.metric(gauge_wind_speed_knots).set(value['knots'])
		self.metric(gauge_wind_speed_value).set(analog_value)
		self.metric(gauge_wind_speed_voltage).set(voltage)

		return value

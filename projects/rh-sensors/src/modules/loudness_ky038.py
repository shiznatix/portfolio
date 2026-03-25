from prometheus import gauge_loudness_value, gauge_loudness_voltage, counter_loudness
from sensors.analog_read import AnalogReadSensor
from sensors.event_detection import EventDetectionSensor

###
# KY-038
# https://www.datasheethub.com/wp-content/uploads/2022/10/Sound-Detection-Sensor-Datasheet.pdf
# Input voltage = 3.3V - 5V
###
_MODULE = 'loudness-ky038'
MODULE_ANALOG = f'{_MODULE}-analog'
MODULE_EVENT_DETECTION = f'{_MODULE}-event-detection'

class SensorAnalog(AnalogReadSensor):
	module: str = MODULE_ANALOG

	def get_value(self):
		value = super().get_value()
		if value is None:
			return None

		self.metric(gauge_loudness_value).set(value['value'])
		self.metric(gauge_loudness_voltage).set(value['voltage'])

		return value

class SensorEventDetection(EventDetectionSensor):
	module: str = MODULE_EVENT_DETECTION

	def event_callback(self):
		super().event_callback()
		self.metric(counter_loudness).inc()

from prometheus import counter_motion
from sensors.event_detection import EventDetectionSensor

MODULE = 'motion-hcsr501'

class Sensor(EventDetectionSensor):
	module: str = MODULE

	def event_callback(self):
		super().event_callback()
		self.metric(counter_motion).inc()

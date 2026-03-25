from prometheus import counter_vibration
from sensors.button import ButtonSensor


MODULE = 'vibration-sw420'

class Sensor(ButtonSensor):
	module: str = MODULE

	def event_callback(self):
		super().event_callback()
		self.metric(counter_vibration).inc()

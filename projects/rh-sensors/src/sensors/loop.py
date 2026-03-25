import abc

import rhpy

from sensor import Sensor

class LoopSensor(Sensor):
	send_every_sec: int | None = None

	@abc.abstractmethod
	def get_value(self) -> dict | float | int | None:
		pass

	def start_send_every(self):
		if not self.send_every_sec:
			return

		def send_value():
			if value := self.get_value():
				self.send_value(value)
			else:
				self.log.warning('Failed to get value')
		rhpy.timer(self.name, self.send_every_sec, send_value)

	def run(self):
		def log_value():
			if value := self.get_value():
				log_extra = value if isinstance(value, dict) else { 'value': value }
				self.log.info('Reading', extra=log_extra)
			else:
				self.log.warning('Failed to get value')
		rhpy.timer(self.name, 30, log_value)
		self.start_send_every()

		while rhpy.running():
			rhpy.wait(1)

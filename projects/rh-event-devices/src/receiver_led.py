from typing import Literal

import gpiozero

import rhpy
from config import LedConfig
from receiver import Receiver, SourceMatch
from prometheus import counter_led

class Led(LedConfig, Receiver):
	type: Literal['led'] = 'led'
	_led: gpiozero.LED

	def init_receiver(self):
		self._led = gpiozero.LED(self.gpio)
		self._led.off()

	def receive(self, data):
		matched_source: SourceMatch[LedConfig.Source] | None = self.get_first_match(data)
		if not matched_source:
			return False

		with self.match_lock:
			if self.match is not None:
				self.log.warning(f'LED busy with {self.match.name}, ignoring')
				return False
			self.match = matched_source
		return True

	def run(self):
		self.log.info('Starting main function')

		while rhpy.running():
			with self.match_lock:
				# get pointer to original obj so we can release lock for the `receive` method
				match: SourceMatch[LedConfig.Source] | None = self.match
			if not match:
				rhpy.wait(0.2)
				continue

			source = match.source
			counter_led.labels(name=self.name, title=self.prometheus_title).inc()
			self.log.info(f'Starting LED {match.name}', extra={
				'gpio': self.gpio,
				'on_secs': source.on_secs,
				'off_secs': source.off_secs,
				'repeat': source.repeat,
			})

			for i in range(source.repeat + 1):
				self.log.info(f'LED loop {i+1}/{source.repeat+1}')
				self._led.on()
				rhpy.wait(source.on_secs)
				self._led.off()
				rhpy.wait(source.off_secs)

			with self.match_lock:
				self.match = None

		self.log.info('Ending main function')

	def cleanup(self):
		self._led.off()
		self._led.close()

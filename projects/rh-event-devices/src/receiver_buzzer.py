import time
from typing import Literal

import gpiozero
import gpiozero.tones

import rhpy
from receiver import Receiver, SourceMatch
from prometheus import counter_buzzes
from config import BuzzerConfig

class Buzzer(BuzzerConfig, Receiver):
	type: Literal['buzzer']  = 'buzzer'
	prev_buzz_time: float = 0.0
	last_buzz_time: float = 0.0
	is_buzzing: bool = False

	def init_receiver(self):
		self.ensure_off(force=True)

	def ensure_off(self, *, force: bool = False):
		if not force and not self.is_buzzing:
			return

		try:
			buzzer = gpiozero.OutputDevice(self.gpio, initial_value=False)
			buzzer.off()
			buzzer.close()
			self.is_buzzing = False
		except Exception as e:
			self.log.error(f'Error forcing buzzer off: {e}', extra={
				'gpio': self.gpio,
			})

	def receive(self, data):
		matched_source: SourceMatch[BuzzerConfig.Source] | None = self.get_first_match(data)
		if not matched_source:
			return False

		with self.match_lock:
			if self.match or not rhpy.running():
				skip_reason = 'already buzzing' if self.match else 'shutting down'
				self.log.warning('Ignoring message', extra={
					'skip_reason': skip_reason,
				})
				return False

			now = time.time()

			# buzz cooldown
			if now - self.last_buzz_time < self.cooldown_sec:
				self.log.warning('Ignoring message, cooldown not reached', extra={
					'last_buzz_time': self.last_buzz_time,
					'cooldown_sec': self.cooldown_sec,
					'now': now,
				})
				return False

			# double buzz cooldown
			if self.double_cooldown_sec is not None and self.prev_buzz_time > 0 and self.last_buzz_time > 0:
				sec_since_prev = now - self.prev_buzz_time
				sec_since_last = now - self.last_buzz_time
				sec_cooldown = self.double_cooldown_sec
				if sec_since_prev < sec_cooldown and sec_since_last < sec_cooldown:
					self.log.warning('Ignoring message, double cooldown not reached', extra={
						'prev_buzz_time': self.prev_buzz_time,
						'last_buzz_time': self.last_buzz_time,
						'double_cooldown_sec': self.double_cooldown_sec,
						'now': now,
					})
					return False

				self.prev_buzz_time = 0
				self.last_buzz_time = 0

			# all good, set our source for buzzing
			self.match = matched_source
			counter_buzzes.labels(name=self.name, title=self.prometheus_title).inc()
		return True

	def run(self):
		self.log.info('Starting main function')

		while rhpy.running():
			self.ensure_off() # prevent buzzing left over from PWM

			with self.match_lock:
				match: SourceMatch[BuzzerConfig.Source] | None = self.match
			if not match:
				rhpy.wait(0.2)
				continue

			source = match.source
			self.is_buzzing = True
			self.log.info(f'Starting buzz: {match.name}')

			for i in range(source.repeat + 1):
				for tone, play_sec in source.melody:
					if not rhpy.running():
						break
					self.log.info(f'Buzzer {match.name} loop:{i} note:{tone}', extra={
						'play_sec': play_sec,
					})

					if isinstance(tone, bool):
						with gpiozero.Buzzer(self.gpio) as buzzer:
							if tone:
								buzzer.on()
							else:
								buzzer.off()
							rhpy.wait(play_sec)
							buzzer.off()
							buzzer.close()
					else:
						with gpiozero.TonalBuzzer(self.gpio) as buzzer:
							buzzer.play(gpiozero.tones.Tone(tone))
							rhpy.wait(play_sec)
							buzzer.stop()
							buzzer.close()

				rhpy.wait(source.repeat_delay_sec)

			self.ensure_off(force=True)
			with self.match_lock:
				self.match = None
				self.prev_buzz_time = self.last_buzz_time
				self.last_buzz_time = time.time()

		self.log.info('Ending main function')

	def cleanup(self):
		self.ensure_off(force=True)

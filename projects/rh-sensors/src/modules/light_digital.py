from __future__ import annotations
import time
from typing import ClassVar

from gpiozero import DigitalOutputDevice, DigitalInputDevice

import rhpy
from prometheus import gauge_light_brightness, gauge_light_rc_secs
from sensors.gpio import GpioSensor
from sensors.loop import LoopSensor

MODULE = 'light-digital'

class Sensor(GpioSensor, LoopSensor):
	class Stats:
		def __init__(self, parent: Sensor):
			self.parent = parent
			self.reads: int = 0
			rhpy.timer(parent.name, 30, self.log)
		def log(self):
			self.parent.log.info(
				f'avg_value:{self.parent.brightness} '
				f'value:{self.parent.brightness} '
				f'rc_secs:{self.parent.rc_secs} '
				f'reads:{self.reads}'
			)
			self.reads = 0

	MAX_RC_SECS_LIST_LEN: ClassVar[int] = 10

	module: str = MODULE
	max_rc_secs: int | float = 1
	min_rc_secs: int | float = 0
	percent_change_threshold: float = 0
	rc_secs_history: list[float] = []
	rc_secs: float = 0
	brightness: float = 0.0
	debounce_sec: float = 0.1

	def reset(self):
		self.rc_secs_history = []
		self.rc_secs = 0
		self.brightness = 0.0

	def read(self):
		rc_secs = 0

		#############
		# # clear the pin
		# output_device = DigitalOutputDevice(self.gpio)
		# output_device.off()
		# rhpy.wait(0.1)
		# output_device.close()

		# # switch the pin to input and count until the pin goes high
		# input_device = DigitalInputDevice(self.gpio, pull_up=False)
		# start_time = time.time()
		# while not input_device.is_active:
		# 	if self.quit_event.is_set() or (time.time() - start_time) >= self.max_rc_secs:
		# 		break
		# 	rhpy.wait(0.01)
		# rc_secs = min(time.time() - start_time, self.max_rc_secs)
		# input_device.close()
		#############

		#############
		# clear the pin
		with DigitalOutputDevice(self.gpio) as output_device:
			output_device.off()

		rhpy.wait(0.5)

		# switch the pin to input and count until the pin goes high
		with DigitalInputDevice(self.gpio, pull_up=False) as input_device:
			start_time = time.time()
			input_device.wait_for_active(timeout=self.max_rc_secs)
			rc_secs = round(min(time.time() - start_time, self.max_rc_secs), 2)
		#############

		self.rc_secs = round(rc_secs, 3)
		self.rc_secs_history.append(rc_secs)
		if len(self.rc_secs_history) > Sensor.MAX_RC_SECS_LIST_LEN:
			self.rc_secs_history.pop(0)

		d = (self.max_rc_secs - self.min_rc_secs) / 100
		avg_rc_secs = round(sum(self.rc_secs_history) / len(self.rc_secs_history))
		percent = max(0, min(100, int((avg_rc_secs - self.min_rc_secs) / d)))
		decimal_percent = round(percent / 100, 2)
		# `percent` is the percent of time it took to charge the capacitor
		# `brightness` is the inverse of this, because the more time it takes to charge the capacitor, the darker it is
		self.brightness = rhpy.round(1 - decimal_percent, 2)

	def get_value(self):
		return {
			'rc_secs': self.rc_secs,
			'brightness': self.brightness,
		}

	def run(self):
		self.reset()
		self.read()
		previous_value = self.get_value()
		stats = self.Stats(self)

		self.metric(gauge_light_brightness).set(previous_value['brightness'])
		self.metric(gauge_light_rc_secs).set(self.rc_secs)
		self.start_send_every()

		while rhpy.running():
			self.read()
			stats.reads += 1

			self.metric(gauge_light_brightness).set(self.brightness)
			self.metric(gauge_light_rc_secs).set(self.rc_secs)

			value_diff = self.brightness - previous_value['brightness']
			# only send if the value has changed more than the threshold
			has_new_brightness = value_diff > self.percent_change_threshold or value_diff < (self.percent_change_threshold * -1)

			if has_new_brightness:
				self.log.info(f'Value changed rc_secs:{self.rc_secs} value_diff:{value_diff} value:{self.brightness}')
				value = self.get_value()
				self.send_value(value)
				previous_value = value

			wait_time = self.debounce_sec if has_new_brightness else 2
			rhpy.wait(wait_time)

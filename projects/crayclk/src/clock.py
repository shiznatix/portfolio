from datetime import datetime
import random

import board
from adafruit_ht16k33 import segments

import rhpy
from config import Config
from state import State


_impossible_hours = random.sample(range(25, 100), 24)
_impossible_minutes = random.sample(range(61, 100), 30)
_impossible_minutes.extend(random.sample(range(61, 100), 30))

def _random_digit() -> str:
	num = random.randint(0, 9)
	digit = f'{num}'
	dot = '.' if random.choice([True, False]) else ''
	return f'{digit}{dot}'

def _time() -> str:
	curr_date = datetime.now()
	time_format = '%H:%M' if curr_date.second % 2 == 0 else '%H%M'
	return curr_date.strftime(time_format)

def _random() -> str:
	num_1 = _random_digit()
	num_2 = _random_digit()
	num_3 = _random_digit()
	num_4 = _random_digit()
	colon = ':' if random.choice([True, False]) else ''
	return f'{num_1}{num_2}{colon}{num_3}{num_4}'

def _impossible() -> str:
	curr_date = datetime.now()
	hour = _impossible_hours[curr_date.hour]
	minute = _impossible_minutes[curr_date.minute]
	return f'{hour}:{minute}' if curr_date.second % 2 == 0 else f'{hour}{minute}'

class Clock(segments.Seg7x4):
	def __init__(self):
		self.log = rhpy.logs('clock')
		super().__init__(
			i2c=board.I2C(),
			auto_write=False,
		)

	def run(self):
		try:
			self.fill(False)
			self.show()
			self.marquee('CRa2y CLOCq    ', loop=False)
			self.show()

			while rhpy.running():
				self.brightness = State.brightness()

				if State.detections():
					self.print(_time())
				elif Config.no_detection_mode == 'random':
					self.print(_random())
				elif Config.no_detection_mode == 'impossible':
					self.print(_impossible())
				elif Config.no_detection_mode == 'off':
					self.fill(False)
				else:
					self.print('9.9.:9.9.')

				self.show()
				rhpy.wait(0.1)
		except Exception as e:
			rhpy.quit(error=e)
		finally:
			try:
				self.print('----')
				self.show()
			except:
				pass
			rhpy.quit()

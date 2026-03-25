import time
from typing import Iterator, Literal

from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import ssd1306, sh1106

import rhpy
from receiver import Receiver
from oled_screen import Screen
from config import OledConfig
from rhpy import matches_sensor_schema

class OledDisplay(OledConfig, Receiver):
	type: Literal['oled_display'] = 'oled_display'
	_oled: ssd1306 | sh1106
	_render_screens: list[Screen]
	_screens_iter: Iterator[Screen]
	_screen_timer: float
	_current_screen: Screen | None

	def init_receiver(self):
		serial = i2c(port=self.i2c_port, address=0x3C)
		if self.device == 'ssd1306':
			self._oled = ssd1306(serial, height=self.height, width=self.width, rotate=self.rotate)
		else:
			self._oled = sh1106(serial, height=self.height, width=self.width, rotate=self.rotate)
		self._oled.clear()

		self._render_screens: list[Screen] = [Screen(s) for s in self.screens]
		self._screens_iter = iter(self._render_screens)
		self._screen_timer = time.time()
		self._current_screen: Screen | None = next(self._screens_iter, None)

	def get_current_screen(self) -> Screen:
		if self._current_screen and time.time() - self._screen_timer < self._current_screen.display_secs:
			return self._current_screen

		screen = next(self._screens_iter, None)
		# recreate iterator if we reached the end
		if not screen:
			self._screens_iter = iter(self._render_screens)
			screen = next(self._screens_iter)

		self._current_screen = screen
		self._screen_timer = time.time()

		return self._current_screen

	def show(self):
		screen = self.get_current_screen()

		with canvas(self._oled) as draw:
			draw.rectangle(self._oled.bounding_box, fill=screen.background_fill, outline=screen.border_fill)

			for element in screen.elements:
				element.draw(draw, screen.content_fill)

	def receive(self, data):
		matched = False
		for screen in self._render_screens:
			for element in screen.elements:
				matched_source, _name, value = matches_sensor_schema(data, element.match_schema)
				if matched_source:
					element.set_value(value)
					matched = True
		return matched

	def run(self):
		self.log.info('Starting main function')

		try:
			while rhpy.running():
				self.show()
				delay_secs = 0.01 if self.get_current_screen().has_animation() else 0.5
				rhpy.wait(delay_secs)
		except Exception as e:
			self.log.exception(e)
			rhpy.quit()
			raise e
		finally:
			self._oled.cleanup()

		self.log.info('Ending main function')

	def cleanup(self):
		pass

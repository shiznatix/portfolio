import rhpy

from config import Config
from receiver_buzzer import Buzzer
from receiver_led import Led
from receiver_pixels import Pixels
from receiver_oled_display import OledDisplay
from receiver_camera_stream import CameraStream

class Receivers:
	def __init__(self):
		self.buzzers: dict[str, Buzzer] = {}
		self.leds: dict[str, Led] = {}
		self.pixels: dict[str, Pixels] = {}
		self.oled_displays: dict[str, OledDisplay] = {}
		self.camera_streams: dict[str, CameraStream] = {}

		if Config.receivers.buzzers:
			for name, conf in Config.receivers.buzzers.items():
				self.buzzers[name] = Buzzer.model_validate(conf.model_dump())

		if Config.receivers.leds:
			for name, conf in Config.receivers.leds.items():
				self.leds[name] = Led.model_validate(conf.model_dump())

		if Config.receivers.pixels:
			for name, conf in Config.receivers.pixels.items():
				self.pixels[name] = Pixels.model_validate(conf.model_dump())

		if Config.receivers.oled_displays:
			for name, conf in Config.receivers.oled_displays.items():
				self.oled_displays[name] = OledDisplay.model_validate(conf.model_dump())

		if Config.receivers.camera_streams:
			for name, conf in Config.receivers.camera_streams.items():
				self.camera_streams[name] = CameraStream.model_validate(conf.model_dump())

	def get_all(self):
		return list(self.buzzers.values()) + list(self.leds.values()) + list(self.pixels.values()) + list(self.oled_displays.values()) + list(self.camera_streams.values())

	def receive(self, data: rhpy.SensorValue):
		matches = 0
		for receiver in self.get_all():
			if receiver.receive(data):
				matches += 1
		return matches

receivers = Receivers()

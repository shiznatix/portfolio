import threading

import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

import rhpy
import i2c_bus
from sensors.i2c import I2CSensor
from sensors.loop import LoopSensor


class _ADS:
	class Channel:
		def __init__(self, analog_in: AnalogIn, lock: threading.RLock):
			self.analog_in = analog_in
			self.lock = lock

		def read(self):
			with self.lock:
				return (self.analog_in.value, self.analog_in.voltage)

	locks: dict[int, threading.RLock] = {}
	ads_instances: dict[int, ADS.ADS1115] = {}

	@staticmethod
	def get_channel(*, i2c_port: int, analog_pin: int, gain: int):
		if i2c_port not in _ADS.locks:
			_ADS.locks[i2c_port] = threading.RLock()

		lock = _ADS.locks[i2c_port]
		with lock:
			if i2c_port not in _ADS.ads_instances:
				_ADS.ads_instances[i2c_port] = ADS.ADS1115(i2c_bus.get(i2c_port), gain)
			return _ADS.Channel(AnalogIn(_ADS.ads_instances[i2c_port], analog_pin), lock)

class AnalogReadSensor(I2CSensor, LoopSensor):
	analog_pin: int
	gain: int = 1
	value_divisor: int = 1
	_channel: _ADS.Channel

	def init_sensor(self):
		self._channel = _ADS.get_channel(
			i2c_port=self.i2c_port,
			analog_pin=self.analog_pin,
			gain=self.gain,
		)

	def get_value(self) -> dict | None:
		try:
			analog_value, voltage = self._channel.read()

			return {
				'value': int(analog_value / self.value_divisor),
				'raw_value': analog_value,
				'voltage': rhpy.round(voltage, 6),
			}
		except Exception as e:
			self.log.error(f'Failed to read sensor: {e}')

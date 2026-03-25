import adafruit_vl53l0x

import i2c_bus
from sensors.distance import DistanceSensor
from sensors.i2c import I2CSensor

MODULE = 'distance-vl53l0x'

class Sensor(I2CSensor, DistanceSensor):
	module: str = MODULE
	vl53: adafruit_vl53l0x.VL53L0X

	def init_sensor(self):
		i2c = i2c_bus.get(self.i2c_port)
		self.vl53 = adafruit_vl53l0x.VL53L0X(i2c)
		# higher speed but less accurate timing budget of 20ms:
		# self.vl53.measurement_timing_budget = 20000
		# slower but more accurate timing budget of 200ms:
		# self.vl53.measurement_timing_budget = 200000
		# The default timing budget is 33ms

	def get_distance_mm(self, *, max_attempts: int = 1, attempt: int = 1) -> int | None:
		distance_mm = self.vl53.range
		return distance_mm if distance_mm > 0 and distance_mm != 8190 else None

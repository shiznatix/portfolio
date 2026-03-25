import rhpy
from prometheus import gauge_temperature
from sensors.onewire import OneWireSensor

MODULE = 'temperature-ds18b20'

class Sensor(OneWireSensor):
	module: str = MODULE

	def get_value(self):
		found_temperature = False

		for _ in range(5):
			lines = self.read_device()
			if lines[0].strip()[-3:] == 'YES':
				found_temperature = True
				break
			rhpy.wait(0.2)

		if not found_temperature:
			raise RuntimeError('Failed to find "YES" in temperature file')

		equals_pos = lines[1].find('t=')
		if equals_pos == -1:
			raise RuntimeError('Failed to find "t=" in temperature file')

		temp_string = lines[1][equals_pos+2:]
		celcius = float(temp_string) / 1000.0 # Celsius
		value = rhpy.round(celcius, 1)

		self.metric(gauge_temperature).set(value)

		return value

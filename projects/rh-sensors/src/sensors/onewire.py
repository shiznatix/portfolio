import glob
import os

from sensors.loop import LoopSensor

class OneWireSensor(LoopSensor):
	device_id_prefix: str
	device_file: str = '' # set in init_sensor

	def init_sensor(self):
		os.system('modprobe w1-gpio')
		os.system('modprobe w1-therm')

		base_dir = '/sys/bus/w1/devices/'
		w1_device_dir = glob.glob(f'{base_dir}{self.device_id_prefix}*')
		if len(w1_device_dir) == 0:
			w1_all_dirs = glob.glob(f'{base_dir}*')
			self.log.error(f'No OneWire device found with prefix:{self.device_id_prefix} in:{base_dir}', extra={
				'all_devices': ','.join(os.path.basename(d) for d in w1_all_dirs),
			})
			raise RuntimeError(f'Failed to find {self.name} device with prefix "{self.device_id_prefix}"')

		device_folder = w1_device_dir[0]
		self.device_file = f'{device_folder}/w1_slave'

	def read_device(self):
		with open(self.device_file, 'r', encoding='utf-8') as f:
			return f.readlines()

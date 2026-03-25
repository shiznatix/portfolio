import os
import glob
import time
import subprocess
import psutil
from src.utils import read_int, read_str
from src.sensors import ProcessSensors, Sensor, MaxVal, SensorGroup, UnknownSensor

import os, glob

def enumerate_all_sensors():
	sensors = {}
	# temperature sensors
	for z in glob.glob('/sys/class/thermal/thermal_zone*'):
		name = open(os.path.join(z, 'type')).read().strip()
		temp = int(open(os.path.join(z, 'temp')).read().strip()) / 1000
		sensors[f'thermal:{name}'] = temp
	# HWMon sensors (CPU, GPU, chipset, etc)
	for h in glob.glob('/sys/class/hwmon/hwmon*'):
		hname = open(os.path.join(h, 'name')).read().strip()
		for f in os.listdir(h):
			if f.endswith('_input'):
				label_file = f.replace('_input', '_label')
				label_path = os.path.join(h, label_file)
				if os.path.exists(label_path):
					label = open(label_path).read().strip()
				else:
					label = f
				val = int(open(os.path.join(h, f)).read().strip())
				# Convert temps from millidegree if it's a temp sensor
				if 'temp' in f:
					val = val / 1000
				sensors[f'hwmon:{hname}:{label}'] = val
	# Fans
	if os.path.exists('/proc/acpi/ibm/fan'):
		fan_info = open('/proc/acpi/ibm/fan').read()
		for m in ['speed', 'status', 'level']:
			if m in fan_info:
				val = fan_info.split(m + ':')[1].split()[0]
				sensors[f'fan:{m}'] = val
	# ThinkPad ACPI sensors (lap mode, tablet mode, etc)
	acpi_path = '/sys/devices/platform/thinkpad_acpi/'
	for f in os.listdir(acpi_path):
		full_path = os.path.join(acpi_path, f)
		if os.path.isfile(full_path):
			val = open(full_path).read().strip()
			sensors[f'acpi:{f}'] = val
	# ---- IIO devices (accelerometers, etc) ----
	for iio in glob.glob('/sys/class/iio/devices/iio:device*'):
		for f in os.listdir(iio):
			if f.endswith('_raw') or f.endswith('_input'):
				full_path = os.path.join(iio, f)
				val = int(open(full_path).read().strip())
				sensors[f'iio:{os.path.basename(iio)}:{f}'] = val
	return sensors

class PowerTracker:
	def __init__(self):
		self.prev_energy = None
		self.prev_time = None

	def update(self, energy_uj):
		if energy_uj is None:
			return None

		current_time = time.time()

		if self.prev_energy is None or self.prev_time is None:
			self.prev_energy = energy_uj
			self.prev_time = current_time
			return None

		energy_delta = energy_uj - self.prev_energy
		time_delta = current_time - self.prev_time

		if time_delta <= 0:
			return None

		watts = energy_delta / time_delta / 1_000_000

		self.prev_energy = energy_uj
		self.prev_time = current_time

		return max(0, watts)

class SystemStatic:
	_cpu_nom_freq = None
	_total_memory = None
	_power_limit = None
	_swap_total = None
	_gpu_vram_total = None

	@staticmethod
	def cpu_nom_freq():
		if SystemStatic._cpu_nom_freq is None:
			f = read_int('/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq')
			SystemStatic._cpu_nom_freq = f / 1_000_000
		return SystemStatic._cpu_nom_freq

	@staticmethod
	def total_memory():
		if SystemStatic._total_memory is None:
			mem = psutil.virtual_memory()
			SystemStatic._total_memory = mem.total // (1024 * 1024)
		return SystemStatic._total_memory

	@staticmethod
	def swap_total():
		if SystemStatic._swap_total is None:
			swap = psutil.swap_memory()
			SystemStatic._swap_total = swap.total // (1024 * 1024)
		return SystemStatic._swap_total

	@staticmethod
	def power_limit():
		if SystemStatic._power_limit is None:
			with open('/sys/class/powercap/intel-rapl/intel-rapl:0/constraint_0_max_power_uw', 'r') as f:
				SystemStatic._power_limit = int(f.read().strip()) / 1_000_000
		return SystemStatic._power_limit

	@staticmethod
	def gpu_vram_total():
		if SystemStatic._gpu_vram_total is None:
			result = subprocess.run(
				['nvidia-smi', '--query-gpu=memory.total', '--format=csv,noheader,nounits'],
				capture_output=True,
				text=True,
				timeout=1.0,
				stdin=subprocess.DEVNULL
			)
			SystemStatic._gpu_vram_total = int(result.stdout.strip())
		return SystemStatic._gpu_vram_total


class SystemDataCollector:
	def __init__(self, sensors: list[Sensor | SensorGroup]):
		self.sensors = sensors
		self.unknown_sensors: list[UnknownSensor] = []
		self.prev_process_data = {}
		self.last_collect_time = None
		self.power_tracker = PowerTracker()
		self.is_root = os.geteuid() == 0

		for sensor in self.sensors:
			if isinstance(sensor, SensorGroup):
				for child_sensor in sensor.sensors:
					self._set_sensor_max_val(child_sensor)
			else:
				self._set_sensor_max_val(sensor)

	def _set_sensor_max_val(self, sensor: Sensor):
		if not isinstance(sensor.max_val, MaxVal):
			return

		if sensor.max_val == MaxVal.CPU_FREQ:
			sensor.max_val = SystemStatic.cpu_nom_freq()
		elif sensor.max_val == MaxVal.SWAP_TOTAL:
			sensor.max_val = SystemStatic.swap_total()
		elif sensor.max_val == MaxVal.MEM_TOTAL:
			sensor.max_val = SystemStatic.total_memory()
		elif sensor.max_val == MaxVal.GPU_VRAM_TOTAL:
			sensor.max_val = SystemStatic.gpu_vram_total()

	def collect(self):
		raw_data = {}

		current_time = time.time()
		elapsed = current_time - self.last_collect_time if self.last_collect_time else 1.0
		self.last_collect_time = current_time

		temp_data = self._collect_temp_sensors()
		raw_data.update(temp_data)

		cpu_temp_data = self._collect_cpu_coretemps()
		raw_data.update(cpu_temp_data)

		gpu_stats = self._read_gpu()
		raw_data[('gpu_temp', None)] = gpu_stats['temp']
		raw_data[('gpu_util', None)] = gpu_stats['util']
		raw_data[('gpu_vram_used', None)] = gpu_stats['vram_used']

		cpu_freq = self._read_cpu_freq()
		raw_data[('cpu_freq', None)] = cpu_freq

		mem_stats = self._read_memory()
		raw_data.update(mem_stats)

		fan_rpm = self._read_fan_rpm()
		raw_data[('fan_rpm', None)] = fan_rpm

		power = self._read_power()
		raw_data[('pwr_usage', None)] = power

		turbo = self._read_turbo()
		raw_data[('turbo', None)] = turbo

		lap_mode = self._read_lap_mode()
		raw_data[('lap_mode', None)] = lap_mode

		self._collect_process_stats(elapsed)

		return self._update_sensors(raw_data)

	def _update_sensors(self, raw_data):
		used_data = set()

		for sensor in self.sensors:
			if isinstance(sensor, SensorGroup):
				continue

			for (kind_str, system_label), value in raw_data.items():
				if kind_str == sensor.kind:
					if sensor.system_label and system_label:
						if sensor.system_label == system_label:
							sensor.update(value)
							used_data.add((kind_str, system_label))
							break
					elif system_label is None:
						sensor.update(value)
						used_data.add((kind_str, system_label))
						break

		for (kind_str, system_label), value in raw_data.items():
			if (kind_str, system_label) not in used_data:
				unknown_key = (kind_str, system_label)
				if unknown_key not in [(s.kind, s.system_label) for s in self.unknown_sensors]:
					self.unknown_sensors.append(
						UnknownSensor(
							kind=kind_str,
							label=system_label or kind_str,
							system_label=system_label
						)
					)

	def _collect_temp_sensors(self):
		result = {}

		for z in glob.glob('/sys/class/thermal/thermal_zone*'):
			name = read_str(os.path.join(z, 'type'))
			t = read_int(os.path.join(z, 'temp')) // 1000
			if 0 < t < 200:
				result[('temp', name)] = t

		return result

	def _collect_cpu_coretemps(self):
		result = {}
		for hw in glob.glob('/sys/class/hwmon/hwmon*'):
			if 'coretemp' not in read_str(os.path.join(hw, 'name')):
				continue
			for t in glob.glob(os.path.join(hw, 'temp*_input')):
				lbl = read_str(t.replace('_input', '_label'))
				if 'Package' in lbl or 'Core' in lbl:
					tval = read_int(t) // 1000
					if 0 < tval < 200:
						result[('cpu_temp', lbl)] = tval
		return result

	def _read_gpu(self):
		result = subprocess.run(
			['nvidia-smi',
			'--query-gpu=temperature.gpu,utilization.gpu,memory.used',
			'--format=csv,noheader,nounits'],
			capture_output=True,
			text=True,
			timeout=1.0,
			stdin=subprocess.DEVNULL
		)
		parts = result.stdout.strip().split(',')
		if len(parts) == 3:
			return {
				'temp': int(parts[0].strip()),
				'util': int(parts[1].strip()),
				'vram_used': int(parts[2].strip())
			}
		return {}

	def _read_cpu_freq(self):
		freq = psutil.cpu_freq(percpu=False)
		if freq:
			return freq.current / 1000.0

	def _read_memory(self):
		result = {}
		mem = psutil.virtual_memory()
		swap = psutil.swap_memory()

		mem_used = mem.used // (1024 * 1024)
		mem_total = mem.total // (1024 * 1024)
		mem_available = mem.available // (1024 * 1024)
		mem_reserved = mem_total - mem_available
		swap_used = swap.used // (1024 * 1024)

		result[('mem_used', None)] = mem_used
		result[('mem_reserved', None)] = mem_reserved
		result[('swap_used', None)] = swap_used

		return result

	def _read_fan_rpm(self):
		fans = psutil.sensors_fans()
		for vals in fans.values():
			return int(vals[0].current)

	def _read_power(self):
		path = '/sys/class/powercap/intel-rapl/intel-rapl:0/energy_uj'
		if self.is_root:
			with open(path, 'r') as f:
				energy_uj = int(f.read().strip())
		else:
			result = subprocess.run(
				['sudo', 'cat', path],
				capture_output=True,
				text=True,
				timeout=0.5,
				stdin=subprocess.DEVNULL
			)
			if result.returncode != 0:
				return None
			energy_uj = int(result.stdout.strip())
		return self.power_tracker.update(energy_uj)

	def _read_turbo(self):
		return read_int('/sys/devices/system/cpu/intel_pstate/no_turbo') == 0

	def _read_lap_mode(self):
		return read_int('/sys/devices/platform/thinkpad_acpi/dytc_lapmode') != 0

	def _collect_process_stats(self, elapsed):
		for sensor in self.sensors:
			if isinstance(sensor, ProcessSensors):
				stats = self._get_process_totals(sensor.process_name, elapsed)
				if stats:
					sensor.cpu_percent.update(stats['cpu_percent'])
					sensor.cpu_secs.update(stats['cpu_secs'])
					sensor.mem_rss.update(stats['rss_mb'])
					sensor.threads.update(stats['threads'])
					sensor.count.update(stats['count'])
				else:
					sensor.cpu_percent.update(None)
					sensor.cpu_secs.update(None)
					sensor.mem_rss.update(None)
					sensor.threads.update(None)
					sensor.count.update(None)

	def _get_process_totals(self, process_name, elapsed):
		total_rss = 0
		total_vms = 0
		total_threads = 0
		total_cpu_time = 0.0
		count = 0

		for proc in psutil.process_iter(['name', 'memory_info', 'num_threads', 'cpu_times']):
			if proc.info['name'] == process_name:
				mem_info = proc.info['memory_info']
				total_rss += mem_info.rss
				total_vms += mem_info.vms
				total_threads += proc.info['num_threads']

				cpu_times = proc.info['cpu_times']
				total_cpu_time += cpu_times.user + cpu_times.system

				count += 1

		if count == 0:
			return None

		rss_mb = total_rss // (1024 * 1024)
		vms_mb = total_vms // (1024 * 1024)

		cpu_percent = 0.0
		prev = self.prev_process_data.get(process_name)
		if prev and elapsed > 0:
			cpu_time_delta = total_cpu_time - prev['cpu_secs']
			cpu_percent = max(0.0, (cpu_time_delta / elapsed) * 100.0)

		self.prev_process_data[process_name] = {
			'cpu_secs': total_cpu_time,
			'rss_mb': rss_mb,
			'vms_mb': vms_mb,
			'threads': total_threads,
			'count': count
		}

		return {
			'cpu_percent': cpu_percent,
			'cpu_secs': total_cpu_time,
			'rss_mb': rss_mb,
			'vms_mb': vms_mb,
			'threads': total_threads,
			'count': count
		}


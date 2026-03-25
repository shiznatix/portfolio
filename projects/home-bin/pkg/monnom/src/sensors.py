from enum import Enum
from rich.text import Text
from src.utils import format_memory_human, format_time_human

BLOCKS = '▁▂▃▄▅▆▇█'
BLOCK_NONE = ' ' # '·'
BLOCK_INIT = ' ' # '.'

class UnknownSensor:
	def __init__(self, kind: str, label: str, system_label: str | None = None):
		self.kind = kind
		self.label = label
		self.system_label = system_label

class Kind(Enum):
	TEMP = 'temp'
	FAN_RPM = 'fan_rpm'
	CPU_TEMP = 'cpu_temp'
	CPU_FREQ = 'cpu_freq'
	MEM_USED = 'mem_used'
	MEM_RESERVED = 'mem_reserved'
	SWAP_USED = 'swap_used'
	PWR_USAGE = 'pwr_usage'
	TURBO = 'turbo'
	LAP_MODE = 'lap_mode'
	GPU_TEMP = 'gpu_temp'
	GPU_UTIL = 'gpu_util'
	GPU_VRAM_USED = 'gpu_vram_used'
	PROC_CPU_PERCENT = 'proc_cpu_percent'
	PROC_CPU_secs = 'proc_cpu_secs'
	PROC_MEM_RSS = 'proc_mem_rss'
	PROC_MEM_VMS = 'proc_mem_vms'
	PROC_THREADS = 'proc_threads'
	PROC_COUNT = 'proc_count'

class MaxVal(Enum):
	CPU_FREQ = '__cpu_freq__'
	MEM_TOTAL = '__mem_total__'
	SWAP_TOTAL = '__swap_total__'
	GPU_VRAM_TOTAL = '__gpu_vram_total__'

class Unit(Enum):
	NA = ''
	DEGREES_C = '°C'
	RPM = ' RPM'
	PERCENT = '%'
	BYTES = '__bytes__'
	WATTS = ' W'
	GHz = ' GHz'
	SECS = '__secs__'

class State(Enum):
	DIM = 'dim'
	GREEN = 'green'
	YELLOW = 'yellow'
	RED = 'red'

class Sensor:
	def __init__(self, kind: str, label: str, **kwargs):
		self.kind: str = kind
		self.label: str = label
		self.max_history: int = kwargs.get('max_history', 80)
		self.history: list = [None] * self.max_history
		self.sparkline: list[Text] = [Text(BLOCK_INIT, style='dim')] * self.max_history
		self.sparkline_2_top: list[Text] = [Text(BLOCK_INIT, style='dim')] * self.max_history
		self.sparkline_2_bottom: list[Text] = [Text(BLOCK_INIT, style='dim')] * self.max_history
		self.curr_val: int | float | None = None
		self.state: State = State.DIM
		self.min_val_seen: int | float | bool | None = None
		self.max_val_seen: int | float | bool | None = None
		self.val_str: str = 'N/A'
		self.min_val_str: str = ''
		self.max_val_str: str = ''
		self.reads_count: int = 0

		self._update_double_sparkline()

		self.system_label: str = kwargs.get('system_label', self.label)
		self.max_val: int | float = kwargs.get('max_val', 100)
		self.min_val: int | float = kwargs.get('min_val', 0)
		self.icon: str = kwargs.get('icon', '')
		self.unit: Unit = kwargs.get('unit', Unit.NA)
		self.alert_at: int | float = kwargs.get('alert_at', 0.9)
		self.warn_at: int | float = kwargs.get('warn_at', 0.8)
		self.alert_at_val: int | float | None = kwargs.get('alert_at_val', None)
		self.warn_at_val: int | float | None = kwargs.get('warn_at_val', None)
		self.high_is_bad: bool = kwargs.get('high_is_bad', True)
		self.is_bool: bool = kwargs.get('is_bool', False)
		self.true_label: str = kwargs.get('true_label', '')
		self.false_label: str = kwargs.get('false_label', '')

	def update(self, val):
		self.curr_val = round(val, 1) if isinstance(val, float) else val

		# Update state (color)
		self._update_state()
		# Shift history left and add new value
		self.history = self.history[1:] + [val]
		# Update sparkline with new value
		self._update_sparkline()
		self._update_double_sparkline()
		# Update formatted value string
		self._update_val_str()
		# Track min/max values
		self._track_min_max()

		self.reads_count += 1

	def _char_to_fraction(self, ch: str) -> float:
		if ch in (BLOCK_NONE, BLOCK_INIT):
			return 0.0
		try:
			idx = BLOCKS.index(ch)
		except ValueError:
			return 0.0
		return idx / (len(BLOCKS) - 1)

	def _fraction_to_char(self, level: float) -> str:
		if level <= 0:
			return BLOCKS[0]
		idx = int(level * len(BLOCKS))
		idx = max(0, min(len(BLOCKS) - 1, idx))
		return BLOCKS[idx]

	def _update_sparkline(self):
		if self.curr_val is None:
			new_char = BLOCK_NONE
		else:
			range_val = self.max_val - self.min_val
			if range_val <= 0:
				new_char = BLOCK_NONE
			else:
				normalized = (self.curr_val - self.min_val) / range_val
				b_len = len(BLOCKS) - 1
				level = int(normalized * b_len)
				level = max(0, min(b_len, level))
				new_char = BLOCKS[level]

		new_text = Text(new_char, style=self.state.value)
		# Shift right and prepend new Text object
		self.sparkline = [new_text] + self.sparkline[:-1]

	def _update_double_sparkline(self):
		top: list[Text] = []
		bottom: list[Text] = []
		for cell in self.sparkline:
			plain = cell.plain
			style = cell.spans[0].style if getattr(cell, 'spans', None) else (cell.style or '')
			if plain in (BLOCK_NONE, BLOCK_INIT):
				top.append(Text(' ', style=style))
				bottom.append(Text(BLOCK_NONE, style=style))
				continue

			fraction = self._char_to_fraction(plain)
			double_level = fraction * 2
			bottom_level = min(1.0, double_level)
			top_level = max(0.0, double_level - 1.0)
			top_char = ' ' if top_level <= 0 else self._fraction_to_char(top_level)
			bottom_char = self._fraction_to_char(bottom_level)
			top.append(Text(top_char, style=style))
			bottom.append(Text(bottom_char, style=style))
		self.sparkline_2_top = top
		self.sparkline_2_bottom = bottom

	def _update_val_str(self):
		val = self.curr_val

		if val is None:
			self.val_str = 'N/A'
		elif self.is_bool:
			self.val_str = self.true_label if val else self.false_label
		elif self.unit == Unit.BYTES:
			formatted_val, unit = format_memory_human(val)
			self.val_str = f'{formatted_val} {unit}'
		elif self.unit == Unit.SECS:
			formatted_val, unit = format_time_human(val)
			self.val_str = f'{formatted_val}{unit}'
		elif isinstance(val, float):
			self.val_str = f'{val:.1f}{self.unit.value}'
		else:
			self.val_str = f'{val}{self.unit.value}'

	def _update_state(self):
		val = self.curr_val

		if val is None:
			self.state = State.DIM
			return
		if self.is_bool:
			self.state = State.GREEN if val else State.RED
			return
		if self.alert_at_val or self.warn_at_val:
			if self.high_is_bad:
				if self.alert_at_val and val >= self.alert_at_val:
					self.state = State.RED
				elif self.warn_at_val and val >= self.warn_at_val:
					self.state = State.YELLOW
				else:
					self.state = State.GREEN
			else:
				if self.alert_at_val and val <= self.alert_at_val:
					self.state = State.RED
				elif self.warn_at_val and val <= self.warn_at_val:
					self.state = State.YELLOW
				else:
					self.state = State.GREEN
			return

		range_val = self.max_val - self.min_val
		if range_val <= 0:
			percent = 0
		else:
			percent = (val - self.min_val) / range_val
		percent = max(0, min(1, percent))

		if self.high_is_bad:
			if percent >= self.alert_at:
				self.state = State.RED
			elif percent >= self.warn_at:
				self.state = State.YELLOW
			else:
				self.state = State.GREEN
		else:
			# Low is bad
			if percent <= (1 - self.alert_at):
				self.state = State.RED
			elif percent <= (1 - self.warn_at):
				self.state = State.YELLOW
			else:
				self.state = State.GREEN

	def _track_min_max(self):
		# Only track min/max for non-None values
		if self.curr_val is None:
			return

		comp = 1 if self.curr_val is True else 0 if self.curr_val is False else self.curr_val

		if self.min_val_seen is None:
			self.min_val_seen = self.max_val_seen = self.curr_val
			self._update_min_str()
			self._update_max_str()
		else:
			min_comp = 1 if self.min_val_seen is True else 0 if self.min_val_seen is False else self.min_val_seen
			max_comp = 1 if self.max_val_seen is True else 0 if self.max_val_seen is False else self.max_val_seen
			if min_comp is not None and comp < min_comp:
				self.min_val_seen = self.curr_val
				self._update_min_str()
			if max_comp is not None and comp > max_comp:
				self.max_val_seen = self.curr_val
				self._update_max_str()

	def _format_bound(self, val, is_min: bool) -> str:
		if val is None or isinstance(val, bool):
			return ''
		arrow = '↓' if is_min else '↑'
		if self.unit == Unit.BYTES:
			fmt, unit = format_memory_human(val)
			return f'{arrow}{fmt}{unit}' if is_min else f'{fmt}{unit}{arrow}'
		if self.unit == Unit.SECS:
			fmt, unit = format_time_human(val)
			return f'{arrow}{fmt}{unit}' if is_min else f'{fmt}{unit}{arrow}'
		core = f'{val:.1f}' if isinstance(val, float) else f'{val}'
		return f'{arrow}{core}' if is_min else f'{core}{arrow}'

	def _update_min_str(self):
		self.min_val_str = self._format_bound(self.min_val_seen, is_min=True)

	def _update_max_str(self):
		self.max_val_str = self._format_bound(self.max_val_seen, is_min=False)

class SensorGroup:
	def __init__(self, label: str, sensors: list[Sensor], **kwargs):
		self.label = label
		self.sensors = sensors
		self.icon = kwargs.get('icon', '')

class ProcessSensors(SensorGroup):
	def __init__(self, label: str, process_name: str, **kwargs):
		icon = kwargs.get('icon', '⚙')

		self.process_name = process_name

		self.cpu_percent = Sensor('proc_cpu_percent', 'CPU%',
			system_label=process_name, icon=icon, unit=Unit.PERCENT, max_val=MaxVal.CPU_FREQ,
			high_is_bad=True, warn_at=0.75, alert_at=0.9)

		self.mem_rss = Sensor('proc_mem_rss', '🎟',
			system_label=process_name, unit=Unit.BYTES, max_val=MaxVal.MEM_TOTAL,
			high_is_bad=True, warn_at=0.75, alert_at=0.9)

		self.cpu_secs = Sensor('proc_cpu_secs', 'CPU ⏱',
			system_label=process_name, unit=Unit.SECS, max_val=10000,
			high_is_bad=False)

		self.threads = Sensor('proc_threads', '🧵',
			system_label=process_name, unit=Unit.NA, max_val=100,
			high_is_bad=True, warn_at=0.75, alert_at=0.9)

		self.count = Sensor('proc_count', 'Proc #',
			system_label=process_name, unit=Unit.NA, max_val=10,
			high_is_bad=False)

		super().__init__(label, [
			self.cpu_percent,
			self.mem_rss,
			self.cpu_secs,
			self.threads,
			self.count
		], icon=icon)

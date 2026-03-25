from dataclasses import dataclass
from enum import Enum
from src.sensors import MaxVal, Sensor, ProcessSensors, SensorGroup, Unit

@dataclass
class ColorScheme:
	border: str
	color_1: str
	color_2: str
	label: str

@dataclass
class DisplaySensor:
	class Mode(Enum):
		GRAPH = 'graph'
		STAT = 'stat'
		BIG_STAT = 'big_stat'
	sensor: Sensor
	mode: Mode = Mode.GRAPH
	rows: int = 1

class GroupKind(Enum):
	HORIZONTAL = 'horizontal'
	VERTICAL = 'vertical'

class Renderer(Enum):
	THIN = 'thin'
	TABLE = 'table'
	PANEL = 'panel'

@dataclass
class HorizontalGroup:
	sensors: list[DisplaySensor]
	kind: GroupKind = GroupKind.HORIZONTAL

@dataclass
class VerticalGroup:
	sensors: list[DisplaySensor]
	kind: GroupKind = GroupKind.VERTICAL

@dataclass
class DisplayGroup:
	label: str
	color_scheme: ColorScheme
	groups: list[HorizontalGroup | VerticalGroup]
	renderer: Renderer = Renderer.THIN

def _ds(sensors: list[Sensor], mode = DisplaySensor.Mode.GRAPH, rows=1):
	return [DisplaySensor(s, mode, rows) for s in sensors]
def _pdg(proc_group: ProcessSensors) -> list[HorizontalGroup | VerticalGroup]:
	return [
		HorizontalGroup(_ds([
			proc_group.cpu_percent, proc_group.mem_rss,
		])),
		HorizontalGroup(_ds([
			proc_group.cpu_secs, proc_group.threads, proc_group.count,
		], DisplaySensor.Mode.STAT)),
	]

c_blue = ColorScheme(border='blue', color_1='#111a26', color_2='#0a1017', label='cyan')
c_magenta = ColorScheme(border='magenta', color_1='#2a2144', color_2='#16112b', label='magenta')
c_pink = ColorScheme(border='bright_magenta', color_1='#3d293d', color_2='#201523', label='bright_magenta')
c_orange = ColorScheme(border='orange3', color_1='#3c260d', color_2='#1f1307', label='orange3')
c_green = ColorScheme(border='green', color_1='#0e3324', color_2='#081a12', label='green')
c_cyan = ColorScheme(border='cyan', color_1='#0b2c31', color_2='#06171a', label='cyan')
c_yellow = ColorScheme(border='yellow', color_1='#37280a', color_2='#1c1405', label='yellow')

temp_kwargs = dict(icon='🌡', unit=Unit.DEGREES_C, max_val=100, min_val=35, high_is_bad=True, warn_at_val=65, alert_at_val=75)
mem_kwargs = dict(icon='🎟', unit=Unit.BYTES, max_val=MaxVal.MEM_TOTAL, high_is_bad=True, warn_at=0.75, alert_at=0.9)
swap_kwargs = dict(icon='💾', unit=Unit.BYTES, max_val=MaxVal.SWAP_TOTAL, high_is_bad=True, warn_at=0.1, alert_at=0.5)

temp_1 = Sensor('temp', 'Area 1', system_label='SEN1', **temp_kwargs)
temp_2 = Sensor('temp', 'Area 2', system_label='SEN2', **temp_kwargs)
temp_apc = Sensor('temp', 'ACPI', system_label='acpitz', **temp_kwargs)
temp_wifi = Sensor('temp', 'WiFi', system_label='iwlwifi_1', **temp_kwargs)
tmp_thermal = Sensor('temp', 'Platform', system_label='INT3400 Thermal', **temp_kwargs)
temp_chipset = Sensor('temp', 'Chipset', system_label='pch_cannonlake', **temp_kwargs)
cpu_temp_zone = Sensor('temp', 'Zone', system_label='x86_pkg_temp', **temp_kwargs)
cpu_temp_hotspot = Sensor('temp', 'Hotspot', system_label='B0D4', **temp_kwargs)
cpu_temp_core = Sensor('cpu_temp', 'Core', system_label='Package id 0', **temp_kwargs)
cpu_temp_core0 = Sensor('cpu_temp', 'Core0', system_label='Core 0', **temp_kwargs)
cpu_temp_core1 = Sensor('cpu_temp', 'Core1', system_label='Core 1', **temp_kwargs)
cpu_temp_core2 = Sensor('cpu_temp', 'Core2', system_label='Core 2', **temp_kwargs)
cpu_temp_core3 = Sensor('cpu_temp', 'Core3', system_label='Core 3', **temp_kwargs)

cpu_freq = Sensor('cpu_freq', 'Freq', icon='⏲', unit=Unit.GHz, max_val=MaxVal.CPU_FREQ, min_val=0.4, high_is_bad=False, warn_at_val=1.2, alert_at_val=1)

mem_used = Sensor('mem_used', 'Used', **mem_kwargs)
mem_reserved = Sensor('mem_reserved', 'Reserved', **mem_kwargs)
swap_used = Sensor('swap_used', 'Swap', **swap_kwargs)

power = Sensor('pwr_usage', 'Power', icon='⚡︎', unit=Unit.WATTS, max_val=25, min_val=1, high_is_bad=True, warn_at=0.25, alert_at=0.5)
fan = Sensor('fan_rpm', 'Fan', icon='𖣘', unit=Unit.RPM, high_is_bad=True, max_val=6000, min_val=4000, warn_at_val=5000, alert_at_val=5200)
turbo = Sensor('turbo', 'Turbo', icon='⚡︎', high_is_bad=False, true_label='On', false_label='Off')
lap_mode = Sensor('lap_mode', 'Lap Mode', icon='⌑', high_is_bad=True, true_label='Detected', false_label='Off')

# NVIDIA GPU sensors
gpu_temp = Sensor('gpu_temp', 'Temp', **temp_kwargs)
gpu_util = Sensor('gpu_util', 'Load', icon='⚙', unit=Unit.PERCENT, max_val=100, high_is_bad=True, warn_at=0.65, alert_at=0.9)
gpu_vram_used = Sensor('gpu_vram_used', 'VRAM', icon='🎟', unit=Unit.BYTES, max_val=MaxVal.GPU_VRAM_TOTAL, high_is_bad=True, warn_at=0.75, alert_at=0.9)

# Process monitoring groups
firefox_group = ProcessSensors('Firefox', 'firefox')
vscode_group = ProcessSensors('VSCode', 'code')
node_group = ProcessSensors('NodeJS', 'node')
npm_group = ProcessSensors('NPM', 'npm')
qq_group = ProcessSensors('qq', 'qq')

SENSORS: list[Sensor | SensorGroup] = [
	temp_1, temp_2, temp_apc, temp_wifi, tmp_thermal, temp_chipset,
	cpu_temp_zone, cpu_temp_hotspot, cpu_temp_core,
	cpu_temp_core0, cpu_temp_core1, cpu_temp_core2, cpu_temp_core3,
	cpu_freq,
	mem_used, mem_reserved, swap_used,
	power, fan, turbo, lap_mode,
	gpu_temp, gpu_util, gpu_vram_used,
	firefox_group, vscode_group, node_group, npm_group, qq_group,
]
DISPLAY_GROUPS: list[list[DisplayGroup]] = [
	[
		DisplayGroup('Memory', c_orange, [
			VerticalGroup(_ds([mem_used], rows=2)),
			HorizontalGroup(_ds([mem_reserved, swap_used], rows=2)),
		], renderer=Renderer.TABLE),
		DisplayGroup('Temps', c_blue, [
			HorizontalGroup(_ds([temp_1, temp_2, temp_apc], rows=2)),
			HorizontalGroup(_ds([tmp_thermal, temp_chipset, temp_wifi], rows=2)),
		]),
		DisplayGroup('Power', c_cyan, [
			VerticalGroup(_ds([power], rows=2)),
			HorizontalGroup(_ds([fan, turbo, lap_mode])),
		]),
	],
	[
		DisplayGroup('CPU', c_magenta, [
			VerticalGroup(_ds([cpu_freq], rows=3)),
			HorizontalGroup(_ds([cpu_temp_zone, cpu_temp_hotspot, cpu_temp_core], rows=2)),
			HorizontalGroup(_ds([cpu_temp_core0, cpu_temp_core1, cpu_temp_core2, cpu_temp_core3], rows=2)),
		]),
		DisplayGroup('GPU', c_green, [
			VerticalGroup(_ds([gpu_temp, gpu_util, gpu_vram_used], rows=3)),
		]),
		DisplayGroup('Big Stats', c_yellow, [
			HorizontalGroup(_ds([
				cpu_temp_hotspot, gpu_temp, power,
			], DisplaySensor.Mode.BIG_STAT)),
		], renderer=Renderer.PANEL),
	],
	[
		DisplayGroup('Firefox', c_pink, _pdg(firefox_group)),
		DisplayGroup('VSCode', c_blue, _pdg(vscode_group)),
		DisplayGroup('NodeJS', c_magenta, _pdg(node_group)),
		DisplayGroup('NPM', c_green, _pdg(npm_group)),
		DisplayGroup('qq', c_orange, _pdg(qq_group)),
	],
]

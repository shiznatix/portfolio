import time
import sys
import termios
import tty
import select
import threading
import traceback
from datetime import datetime
from rich.console import Console, Group
from rich.layout import Layout
from rich.panel import Panel
from rich.live import Live
from rich.table import Table
from rich.text import Text
from rich import box

from src.config import SENSORS, DISPLAY_GROUPS
from src.collector import SystemDataCollector, enumerate_all_sensors
from src.sensors import SensorGroup, UnknownSensor
from src.draw import DisplayGroupRenderer
import json

BOARD_TITLE = 'Someboard'
CLOCK_FRAMES = '🕐🕜🕑🕝🕒🕞🕓🕟🕔🕠🕕🕡🕖🕢🕗🕣🕘🕤🕙🕥🕚🕦🕛🕧'


def create_dashboard_layout(
	paused: bool = False,
	clock_index: int = 0,
	collector_errors: list[str] | None = None,
	unknown_sensors: list[UnknownSensor] | None = None,
) -> Layout:
	timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
	clock_icon = CLOCK_FRAMES[clock_index % len(CLOCK_FRAMES)]
	main_text = Text(style='bold cyan', justify='center')
	main_text.append(BOARD_TITLE, style='bold bright_cyan')
	main_text.append(f'  •  {clock_icon} {timestamp}')

	header_content = Text(justify='center')
	if paused:
		header_content.append('⏸️  ')
		header_content.append(' PAUSED ', style='bold black on bright_yellow')
		header_content.append(' ⏸️     ')
		header_content.append(main_text)
		header_content.append('    ⏸️  ')
		header_content.append(' PAUSED ', style='bold black on bright_yellow')
		header_content.append(' ⏸️')
	else:
		header_content.append(main_text)
	header = Panel(
		header_content,
		box=box.HEAVY,
		style='cyan'
	)

	columns = [[], [], []]
	for col_idx, column_groups in enumerate(DISPLAY_GROUPS):
		for d_group in column_groups:
			renderer = DisplayGroupRenderer(d_group)
			columns[col_idx].append(renderer.to_panel())

	if collector_errors:
		error_text = '\n'.join(collector_errors[-3:])
		error_panel = Panel(
			Text(error_text, style='red', overflow='ellipsis'),
			title='[bold red]Errors[/bold red]',
			border_style='red',
			box=box.ROUNDED,
			height=5
		)
		columns[0].append(error_panel)

	col0_content = Group(*columns[0]) if columns[0] else ''
	col1_content = Group(*columns[1]) if columns[1] else ''
	col2_content = Group(*columns[2]) if columns[2] else ''

	main_table = Table.grid(padding=1, expand=True)
	main_table.add_column(ratio=1, vertical='top')
	main_table.add_column(ratio=1, vertical='top')
	main_table.add_column(ratio=1, vertical='top')
	main_table.add_row(col0_content, col1_content, col2_content)

	footer_text = Text(justify='left')
	footer_text.append(Text(' q: quit  |  p: pause/resume', style='bold'))
	if unknown_sensors:
		unknown_csv = ', '.join([f'{s.label}:{s.kind}' for s in unknown_sensors])
		footer_text.append('  |  Unknown: ', style='dim orange3')
		footer_text.append(unknown_csv, style='orange3')

	layout = Layout()
	layout.split_column(
		Layout(header, size=3),
		Layout(main_table),
		Layout(footer_text, size=1)
	)

	return layout


def dashboard(interval: int):
	console = Console()
	collector = SystemDataCollector(SENSORS)
	collector.collect()
	paused = False
	last_display_time = 0
	clock_index = 0
	running = True
	collector_errors: list[str] = []

	def collection_thread():
		while running:
			if not paused:
				try:
					collector.collect()
				except Exception as e:
					tb = traceback.extract_tb(e.__traceback__)[-1]
					filename = tb.filename.split('/')[-1]
					error_msg = f'{filename}:{tb.lineno} {str(e)}'
					if error_msg not in collector_errors:
						collector_errors.append(error_msg)
						if len(collector_errors) > 5:
							collector_errors.pop(0)
				for _ in range(int(interval * 10)):
					if not running:
						break
					time.sleep(0.1)
			else:
				time.sleep(0.1)

	collection_worker = threading.Thread(target=collection_thread, daemon=True)
	collection_worker.start()

	fd = sys.stdin.fileno()
	old_settings = termios.tcgetattr(fd)

	try:
		tty.setcbreak(fd)
		with Live(console=console, refresh_per_second=1, screen=True) as live:
			while running:
				current_time = time.time()

				if (current_time - last_display_time) >= 1.0:
					layout = create_dashboard_layout(
						paused,
						clock_index,
						collector_errors,
						collector.unknown_sensors,
					)
					live.update(layout)
					last_display_time = current_time
					clock_index += 1

				if select.select([sys.stdin], [], [], 0.1)[0]:
					key = sys.stdin.read(1).lower()
					if key == 'q':
						running = False
						break
					elif key == 'p':
						paused = not paused
						last_display_time = 0
				else:
					time.sleep(0.1)

	except KeyboardInterrupt:
		running = False
	finally:
		termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
		collection_worker.join(timeout=2)


def print_once(pretty: bool = False):
	print(json.dumps(enumerate_all_sensors(), indent=2, sort_keys=True))
	return
	collector = SystemDataCollector(SENSORS)
	collector.collect()

	if pretty:
		layout = create_dashboard_layout(False, 0, [], [])
		console = Console()
		console.print(layout)
		return

	for sensor in SENSORS:
		if isinstance(sensor, SensorGroup):
			all_none = all(child.curr_val is None for child in sensor.sensors)
			if all_none:
				print(f'[{sensor.label}]: N/A')
			else:
				print(f'[{sensor.label}]:')
				for child_sensor in sensor.sensors:
					if child_sensor.curr_val is not None:
						print(f'  {child_sensor.label}: {child_sensor.val_str}')
		else:
			print(f'{sensor.label}: {sensor.val_str}')

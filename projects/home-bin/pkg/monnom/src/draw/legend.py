from rich.table import Table
from rich.text import Text

from src.sensors import Sensor


def build_legend(sensor: Sensor) -> Table:
	grid = Table.grid(expand=True, padding=0, collapse_padding=True)
	entries = []

	def add(label: str, val, style: str):
		if val is None:
			return
		text = Text()
		text.append(label, style=f'dim {style}')
		text.append(str(val), style=style)
		entries.append(text)

	s = sensor
	alert_val = s.alert_at_val if s.alert_at_val is not None else f'{int(s.alert_at * 100)}%'
	warn_val = s.warn_at_val if s.warn_at_val is not None else f'{int(s.warn_at * 100)}%'
	add('↑', alert_val, 'red')
	add('↑', warn_val, 'yellow')
	add('', s.curr_val, sensor.state.value)
	add('↟', s.max_val, 'dim')
	add('↡', s.min_val, 'dim')

	for _ in entries:
		grid.add_column(ratio=1, justify='center')
	grid.add_row(*entries)
	return grid

__all__ = ['build_legend']

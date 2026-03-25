from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from src.config import DisplayGroup, DisplaySensor, GroupKind
from src.sensors import State

class PanelDisplayRenderer:
	def __init__(self, display_group: DisplayGroup):
		self.display_group = display_group

	def _style_for_sensor(self, sensor_state: State):
		c_scheme = self.display_group.color_scheme
		if sensor_state == State.RED:
			return ('red', 'white')
		if sensor_state == State.YELLOW:
			return ('yellow3', 'black')
		if sensor_state == State.GREEN:
			return (c_scheme.color_1, 'white')
		return (c_scheme.color_2, c_scheme.label)

	def _panel_for_sensor(self, ds: DisplaySensor) -> Panel:
		s = ds.sensor
		bg_color, text_color = self._style_for_sensor(s.state)
		panel_style = f"bold {text_color} on {bg_color}"

		content = Table.grid(expand=True, padding=0, collapse_padding=True, pad_edge=False)
		content.add_row(Text(s.val_str, style=panel_style, justify='center'))
		content.add_row(Text(s.label, style=panel_style, justify='center'))

		return Panel(
			content,
			padding=(0, 1),
			border_style=bg_color,
			title=Text(s.label, style=panel_style),
			title_align='center',
			style=f"on {bg_color}",
			expand=True,
		)

	def _row(self, sensors: list[DisplaySensor]) -> Table:
		row = Table.grid(expand=True, padding=0, collapse_padding=True, pad_edge=False)
		for _ in sensors:
			row.add_column(ratio=1, no_wrap=True)
		panels = [self._panel_for_sensor(ds) for ds in sensors]
		row.add_row(*panels)
		return row

	def to_panel(self):
		c_scheme = self.display_group.color_scheme
		body = Table.grid(expand=True, padding=0, collapse_padding=True, pad_edge=False)
		body.add_column(ratio=1)

		for group in self.display_group.groups:
			if group.kind == GroupKind.HORIZONTAL:
				body.add_row(self._row(group.sensors))
			elif group.kind == GroupKind.VERTICAL:
				for sensor in group.sensors:
					body.add_row(self._row([sensor]))
			else:
				raise ValueError(f'Unknown group type: {type(group)}')

		return Panel(
			body,
			title=Text(self.display_group.label, style=f'bold {c_scheme.label}'),
			border_style=c_scheme.border,
			padding=(0, 1),
		)

__all__ = ['PanelDisplayRenderer']

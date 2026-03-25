from rich.table import Table
from rich.text import Text

from src.config import ColorScheme, DisplaySensor, GroupKind
from .legend import build_legend

class SensorDisplayBuilder:
	def __init__(self, color_scheme: ColorScheme):
		self.color_scheme = color_scheme

	def _stat(self, kind: GroupKind, ds: DisplaySensor, idx: int) -> tuple[list[Text], list[Table]]:
		s = ds.sensor
		bg = self.color_scheme.color_1 if idx % 2 == 0 else self.color_scheme.color_2
		row_style = s.state.value if s.state.value in ('yellow', 'red') else f"{self.color_scheme.label} on {bg}"
		title: list[Text] = [Text(s.label, style=row_style)]
		content = Table.grid(expand=True, padding=(0, 1))
		content.add_column(no_wrap=True)
		content.add_column(ratio=1, justify='center')
		content.add_row(
			Text(s.icon, style=row_style),
			Text(s.val_str, style=f'bold {row_style}'),
		)
		content.style = row_style
		return (title, [content])

	def _graph(self, kind: GroupKind, ds: DisplaySensor, idx: int) -> tuple[list[Text], list[Table]]:
		s = ds.sensor
		bg = self.color_scheme.color_1 if idx % 2 == 0 else self.color_scheme.color_2
		row_style = s.state.value if s.state.value in ('yellow', 'red') else f"{self.color_scheme.label} on {bg}"
		title: list[Text] = []
		left_el = s.icon
		if kind == GroupKind.VERTICAL:
			title.extend([
				Text(s.label, style=f'bold {row_style}'),
				Text(s.val_str, style=f'bold {row_style}'),
			])
		else:
			title.append(Text(s.label, style=f'bold {row_style}'))
			left_el = s.val_str

		tables: list[Table] = []
		content = Table.grid(expand=True, padding=(0, 1), collapse_padding=True, pad_edge=False)
		content.add_column(no_wrap=True)
		content.add_column(ratio=1, no_wrap=True)

		left_txt = Text(left_el, style=row_style)
		if ds.rows == 1:
			content.add_row(left_txt, Text(overflow='crop').join(s.sparkline))
		elif ds.rows > 1:
			content.add_row(left_txt, Text(overflow='crop').join(s.sparkline_2_top))
			content.add_row('', Text(overflow='crop').join(s.sparkline_2_bottom))
			if ds.rows > 2:
				content.add_row('', build_legend(s))
		content.style = row_style
		tables.append(content)

		return (title, [content])

	def build(self, kind: GroupKind, ds: DisplaySensor, idx: int) -> tuple[list[Text], list[Table]]:
		if ds.mode in (DisplaySensor.Mode.STAT, DisplaySensor.Mode.BIG_STAT):
			sections = self._stat(kind, ds, idx)
		else:
			sections = self._graph(kind, ds, idx)
		return sections

__all__ = ['SensorDisplayBuilder']

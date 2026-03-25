from rich.table import Table
from rich.text import Text
from rich import box

from src.config import DisplayGroup, DisplaySensor, GroupKind, HorizontalGroup, VerticalGroup
from .sensor import SensorDisplayBuilder
from .types import RowElements, TableSections

class TableDisplayRenderer:
	def __init__(self, display_group: DisplayGroup):
		self.display_group = display_group
		self.builder = SensorDisplayBuilder(display_group.color_scheme)

	def _build_row(self, kind: GroupKind, sensors: list[DisplaySensor]) -> RowElements:
		titles: list[list[Text]] = []
		tables = []
		for idx, sensor in enumerate(sensors):
			title_text, body_table = self.builder.build(kind, sensor, idx)
			titles.append(title_text)
			tables.extend(body_table)
		return (titles, tables)

	def _spread_titles(self, titles: list[list[Text]]) -> Table:
		grid = Table.grid(expand=True, padding=0, collapse_padding=True)
		for _ in titles:
			grid.add_column(ratio=1)
		row = []
		for parts in titles:
			row.append(Text(' ').join(parts))
		grid.add_row(*row)
		return grid

	def _spread_bodies(self, bodies: list[Table]) -> Table:
		if not bodies:
			return Table.grid(expand=True, padding=0, collapse_padding=True)
		grid = Table.grid(expand=True, padding=0, collapse_padding=True)
		for _ in bodies:
			grid.add_column(ratio=1)
		grid.add_row(*bodies)
		return grid

	def to_panel(self):
		c_scheme = self.display_group.color_scheme
		main = Table(show_header=False, expand=True, box=box.SQUARE, border_style=c_scheme.border, padding=0)
		main.add_column(ratio=1, vertical='top', no_wrap=True)
		main.title = Text(self.display_group.label, style=f'bold {c_scheme.label}')

		sections: TableSections = []
		for group in self.display_group.groups:
			if group.kind == GroupKind.HORIZONTAL:
				sections.append(self._build_row(group.kind, group.sensors))
			elif group.kind == GroupKind.VERTICAL:
				rows = [self._build_row(group.kind, [ds]) for ds in group.sensors]
				sections.extend(rows)
			else:
				raise ValueError(f'Unknown group type: {type(group)}')

		for titles, bodies in sections:
			title_grid = self._spread_titles(titles)
			body_grid = self._spread_bodies(bodies)
			section = Table.grid(expand=True, padding=0, collapse_padding=True)
			section.add_row(title_grid)
			section.add_row(body_grid)
			main.add_row(section)

		return main

__all__ = ['TableDisplayRenderer']

from rich.rule import Rule
from rich.table import Table
from rich.text import Text

from src.config import ColorScheme, DisplayGroup, DisplaySensor, GroupKind, HorizontalGroup, VerticalGroup
from .sensor import SensorDisplayBuilder
from .types import Align, RowElements, TableSections


class ThinTable:
	def __init__(self, header: list[Text], sections: TableSections, c_scheme: ColorScheme, footer: list[Text] | None = None):
		self.header = header
		self.sections = sections
		self.border_style = c_scheme.border
		self.color_scheme = c_scheme
		self.footer = footer or []

	def _title(self, title: Text, align: Align) -> Rule:
		# '╭' '╮'
		# '╰' '╯'
		# ╔ ╗
		# ╚ ╝
		cap = Text('╯', style=self.border_style)
		cap.append(title.copy())
		cap.append('╰', style=self.border_style)
		cap.overflow = 'crop'
		cap.stylize('overline', 1, len(cap) - 1)
		cap.stylize(self.border_style, 0, len(cap))
		return Rule(cap, align=align, characters='─', style=self.border_style)

	def _spread_even(
		self,
		parts: list[Text] | list[list[Text]],
		align: Align = 'center',
	) -> Table | Rule:
		if not parts:
			return Rule(characters='─', style=self.border_style)

		columns: list[Text]
		if isinstance(parts[0], list):
			columns = [Text(' ').join(col) for col in parts]  # type: ignore[list-item]
		else:
			columns = parts  # type: ignore[assignment]

		if len(columns) == 1:
			return self._title(columns[0], align)

		grid = Table.grid(expand=True, padding=0, collapse_padding=True)
		for idx in range(len(columns)):
			grid.add_column(ratio=1)
			if idx < len(columns) - 1:
				grid.add_column(no_wrap=True, width=1)

		cells = []
		for idx, part in enumerate(columns):
			cells.append(self._title(part, align))
			if idx < len(columns) - 1:
				cells.append(Text('┬', style=self.border_style))

		grid.add_row(*cells)
		return grid

	def _spread_body(self, parts: list[Table]) -> tuple[Table, int]:
		if not parts:
			empty = Table.grid(expand=True, padding=0, collapse_padding=True, pad_edge=False)
			return empty, 1
		if len(parts) == 1:
			return parts[0], self._row_count(parts[0])

		max_rows = max(self._row_count(p) for p in parts)
		sep = Text('\n'.join(['│'] * max_rows), style=self.border_style, no_wrap=True)

		grid = Table.grid(expand=True, padding=0, collapse_padding=True)
		for idx in range(len(parts)):
			grid.add_column(ratio=1)
			if idx < len(parts) - 1:
				grid.add_column(no_wrap=True, width=1)

		cells = []
		for idx, part in enumerate(parts):
			cells.append(part)
			if idx < len(parts) - 1:
				cells.append(sep)

		grid.add_row(*cells)
		return grid, max_rows

	def _row_count(self, tbl: Table) -> int:
		return getattr(tbl, 'row_count', len(getattr(tbl, 'rows', []))) or 1

	def render(self) -> Table:
		if not self.header and not self.sections:
			return Table.grid(expand=True, padding=0, collapse_padding=True, pad_edge=False)

		# Manual glyph frame so the header sits inside the top border line.
		table = Table.grid(expand=True, padding=0, collapse_padding=True, pad_edge=False)
		table.add_column(no_wrap=True, width=1, style=self.border_style)
		table.add_column(ratio=1)
		table.add_column(no_wrap=True, width=1, style=self.border_style)

		total_rows = (len(self.sections) * 2) + (1 if self.footer else 0) + 1

		def glyphs(row_idx: int) -> tuple[str, str]:
			if row_idx == 0:
				return '╭', '╮'
			if row_idx == total_rows:
				return '╰', '╯'
			return ('│', '│') if row_idx % 2 == 0 else ('├', '┤')

		head_content = self._spread_even([self.header], align='left')
		l, r = glyphs(0)
		table.add_row(Text(l), head_content, Text(r))

		for idx, (title_parts, body_parts) in enumerate(self.sections):
			row_idx = (idx * 2) + 1
			l_char, r_char = glyphs(row_idx)
			title_block = self._spread_even(title_parts)
			title_rows = self._row_count(title_block) if isinstance(title_block, Table) else 1
			l = Text('\n'.join([l_char] * title_rows), style=self.border_style)
			r = Text('\n'.join([r_char] * title_rows), style=self.border_style)
			table.add_row(l, title_block, r)

			row_body_idx = row_idx + 1
			l_char, r_char = glyphs(row_body_idx)
			body_block, body_rows = self._spread_body(body_parts)
			l = Text('\n'.join([l_char] * body_rows), style=self.border_style)
			r = Text('\n'.join([r_char] * body_rows), style=self.border_style)
			table.add_row(l, body_block, r)

		if self.footer:
			footer_idx = (len(self.sections) * 2) + 1
			l_char, r_char = glyphs(footer_idx)
			footer_content = self._spread_even([self.footer], align='left')
			footer_rows = self._row_count(footer_content) if isinstance(footer_content, Table) else 1
			l = Text('\n'.join([l_char] * footer_rows), style=self.border_style)
			r = Text('\n'.join([r_char] * footer_rows), style=self.border_style)
			table.add_row(l, footer_content, r)

		l, r = glyphs(total_rows)
		table.add_row(Text(l), Rule(characters='─', style=self.border_style), Text(r))

		return table


class ThinTableDisplayRenderer:
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

	def to_panel(self):
		sections: TableSections = []
		for group in self.display_group.groups:
			if group.kind == GroupKind.HORIZONTAL:
				titles, tables = self._build_row(group.kind, group.sensors)
				sections.append((titles, tables))
			elif group.kind == GroupKind.VERTICAL:
				rows = [self._build_row(group.kind, [ds]) for ds in group.sensors]
				sections.extend(rows)
			else:
				raise ValueError(f'Unknown group type: {type(group)}')

		c_scheme = self.display_group.color_scheme
		header_parts = [
			Text(self.display_group.label, style=f'bold {c_scheme.label}'),
		]
		return ThinTable(header_parts, sections, c_scheme).render()


__all__ = ['ThinTable', 'ThinTableDisplayRenderer']

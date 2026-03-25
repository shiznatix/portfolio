from rich.text import Text

from src.config import DisplayGroup, Renderer
from .thin_renderer import ThinTableDisplayRenderer
from .table_renderer import TableDisplayRenderer
from .big_stat_renderer import PanelDisplayRenderer


class DisplayGroupRenderer:
	def __init__(self, display_group: DisplayGroup):
		self.display_group = display_group

	def to_panel(self):
		renderer = getattr(self.display_group, 'renderer', Renderer.THIN)
		if isinstance(renderer, str):
			try:
				renderer = Renderer(renderer)
			except ValueError:
				renderer = Renderer.THIN

		if renderer == Renderer.TABLE:
			return TableDisplayRenderer(self.display_group).to_panel()
		if renderer == Renderer.PANEL:
			return PanelDisplayRenderer(self.display_group).to_panel()
		return ThinTableDisplayRenderer(self.display_group).to_panel()

__all__ = ['DisplayGroupRenderer']

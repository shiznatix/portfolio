from __future__ import annotations
from enum import Enum

from gst.lib import CairoContext

class Color(Enum):
	RED = (1.0, 0.0, 0.0)
	GREEN = (0.0, 1.0, 0.0)
	LIGHT_GREEN = (0.5, 1.0, 0.0)
	BLUE = (0.0, 0.0, 1.0)
	YELLOW = (1.0, 1.0, 0.0)
	WHITE = (1.0, 1.0, 1.0)
	BLACK = (0.0, 0.0, 0.0)
	ORANGE = (1.0, 0.5, 0.0)
	def set(self, cr: CairoContext, alpha: float = 1.0):
		cr.set_source_rgba(self.value[0], self.value[1], self.value[2], alpha)

	@staticmethod
	def convert(color) -> Color:
		if isinstance(color, str):
			return Color.from_str(color)
		elif isinstance(color, list) or isinstance(color, tuple):
			return Color.from_tuple(color)
		return Color.WHITE

	@staticmethod
	def from_str(s: str) -> Color:
		try:
			return Color[s.upper()]
		except:
			return Color.WHITE

	@staticmethod
	def from_tuple(t: tuple | list) -> Color:
		if len(t) == 3:
			return Color((t[0]/255.0, t[1]/255.0, t[2]/255.0))
		else:
			return Color.WHITE

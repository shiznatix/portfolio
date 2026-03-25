from contextlib import contextmanager
from dataclasses import dataclass, field
import math

import rhpy

from gst.lib import (
	CairoContext, CairoImageSurface, CairoTextExtents,
	CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_BOLD, CAIRO_FORMAT_ARGB32, CAIRO_OPERATOR_CLEAR,
)
from gst.overlay.color import Color
import templates as tmpl
from config import Config

DEFAULT_FONT_SIZE = 24

@dataclass
class _RenderResult:
	surface: CairoImageSurface = field(default=None)  # type: ignore[assignment]

@dataclass
class _LineExtents:
	x_bearing: float = 0
	y_bearing: float = 0
	width: float = 0
	height: float = 0
	x_advance: float = 0
	y_advance: float = 0
	def add_text_extents(self, ext: CairoTextExtents):
		self.x_bearing = min(self.x_bearing, ext.x_bearing)
		self.y_bearing = min(self.y_bearing, ext.y_bearing)
		self.width += ext.width
		self.height = max(self.height, ext.height)
		self.x_advance += ext.x_advance
		self.y_advance += ext.y_advance
	def __str__(self) -> str:
		return (
			f'Extents(x_bearing={self.x_bearing}, '
			f'y_bearing={self.y_bearing}, '
			f'width={self.width}, '
			f'height={self.height}, '
			f'x_advance={self.x_advance}, '
			f'y_advance={self.y_advance})'
		)

class Overlay:
	def __init__(self):
		self.paint_lock = rhpy.PerfLock(f'{type(self).__name__}.paint', threshold=0.05)
		self.draw_lock = rhpy.PerfLock(f'{type(self).__name__}.draw', threshold=0.05)

		self.live_surface = CairoImageSurface(CAIRO_FORMAT_ARGB32, Config.screen_width, Config.screen_height)
		self.build_surface = CairoImageSurface(CAIRO_FORMAT_ARGB32, Config.screen_width, Config.screen_height)
		self.live_cr = CairoContext(self.live_surface)
		self.build_cr = CairoContext(self.build_surface)

		if Config.overlay_rotate:
			rotate_radians = math.radians(Config.overlay_rotate * -1)
			for cr in (self.live_cr, self.build_cr):
				cr.translate(Config.screen_width / 2, Config.screen_height / 2)
				cr.rotate(rotate_radians)
				cr.translate(-Config.screen_width / 2, -Config.screen_height / 2)

		self.font_size = DEFAULT_FONT_SIZE
		self.color = Color.WHITE
		self.alpha = 1.0
		self.bg_color = Color.BLACK
		self.set_properties()

	def add_line_extents(self, lines: tmpl.Lines):
		self.build_cr.save()
		self.set_properties()
		extents = _LineExtents()
		new_lines: list[tuple[_LineExtents, tmpl.Lines.Line]] = []
		for line in lines:
			if isinstance(line, tmpl.Lines.Break):
				extents.height += line.height
				new_lines.append((_LineExtents(height=line.height), line))
			elif isinstance(line, tmpl.Lines.Text):
				line_extents = _LineExtents()
				for part in line:
					if isinstance(part, tmpl.Parts.TextProps):
						self.set_properties(font_size=part.size, color=part.color)
					elif isinstance(part, tmpl.Parts.Text):
						if part.props:
							self.build_cr.save()
							self.set_properties(font_size=part.props.size, color=part.props.color)
						text_extents = self.build_cr.text_extents(part.text)
						line_extents.add_text_extents(text_extents)
						if part.props:
							self.build_cr.restore()
				extents.height += line_extents.height
				extents.width = max(extents.width, line_extents.width)
				new_lines.append((line_extents, line))
		self.build_cr.restore()
		return (extents, new_lines)

	def set_properties(self, *, color: Color | str | None = None, alpha: float | None = None, font_size: int | None = None):
		self.build_cr.select_font_face('Sans', CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_BOLD)

		font_size = font_size or self.font_size
		font_size = int(font_size * Config.font_size_scale)
		self.build_cr.set_font_size(font_size)

		color = color if isinstance(color, Color) else Color.convert(color) if color else self.color
		alpha = alpha or self.alpha
		color.set(self.build_cr, alpha)

	def bottom_right(self, extents: CairoTextExtents):
		x = Config.screen_width - extents.width - 10
		y = Config.screen_height - extents.height
		return x, y

	def bottom_left(self, extents: CairoTextExtents):
		x = 10 - extents.x_bearing
		y = Config.screen_height - extents.height
		return x, y

	def background(self, extents: CairoTextExtents, x: int | float, y: int | float, *, padding: int = 5):
		# Align background rectangle to text baseline and height
		rect_x = x + extents.x_bearing - padding
		rect_y = y + extents.y_bearing - padding
		rect_width = extents.width + 2 * padding
		rect_height = extents.height + 2 * padding
		self.build_cr.rectangle(rect_x, rect_y, rect_width, rect_height)
		self.build_cr.fill()

	def clear(self):
		self.build_cr.save()
		self.build_cr.set_operator(CAIRO_OPERATOR_CLEAR)
		self.build_cr.paint()  # Clear the surface
		self.build_cr.restore()
		self.build_cr.move_to(0, 0)

	@contextmanager
	def render_context(self):
		result = _RenderResult()
		with self.draw_lock:
			self.set_properties()
			self.clear()
			# Reset transform so pre-rendered surfaces are in device coords.
			# set_surface() will re-apply rotation when blitting via draw_context().
			self.build_cr.save()
			self.build_cr.identity_matrix()
			yield result
			self.build_cr.restore()

			dst = CairoImageSurface(
				self.build_surface.get_format(),
				self.build_surface.get_width(),
				self.build_surface.get_height(),
			)
			cr = CairoContext(dst)
			cr.set_source_surface(self.build_surface, 0, 0)
			cr.paint()
			result.surface = dst

	@contextmanager
	def draw_context(self):
		# Renders into the build surface then swaps live and build surfaces
		with self.draw_lock:
			self.set_properties()
			self.clear()
			with rhpy.perf(threshold=0.01, key=f'{type(self).__name__}.draw'):
				yield

			with self.paint_lock:
				with rhpy.perf(threshold=0.05, key=f'{type(self).__name__}.swap'):
					self.live_surface, self.build_surface = self.build_surface, self.live_surface
					self.live_cr, self.build_cr = self.build_cr, self.live_cr

	def paint(self, frame_cr: CairoContext):
		with self.paint_lock:
			frame_cr.set_source_surface(self.live_surface, 0, 0)
			frame_cr.paint()

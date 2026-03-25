import event
from config import Config
from gst.lib import CairoImageSurface
from gst.overlay.overlay import Overlay

class Name(Overlay):
	def __init__(self, name: str):
		super().__init__()
		self.all_surfaces: dict[str, CairoImageSurface] = {}
		for stream in Config.streams:
			self.all_surfaces[stream.name] = self.render(stream.name)

		self.set_surface(name)
		event.subscribe(event.ActiveStreamChange, lambda pl: self.set_surface(pl.name))

	def render(self, name: str) -> CairoImageSurface:
		with self.render_context() as result:
			# top-left
			extents = self.build_cr.text_extents(name)
			x = 1 - extents.x_bearing + 10
			y = 1 - extents.y_bearing + 10
			self.build_cr.move_to(x, y)
			self.build_cr.show_text(name)
		return result.surface

	def set_surface(self, name: str):
		if surface := self.all_surfaces.get(name):
			with self.draw_context():
				self.build_cr.set_source_surface(surface, 0, 0)
				self.build_cr.paint()

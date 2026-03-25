import time

import rhpy
from gst.overlay.overlay import Overlay

class Timestamp(Overlay):
	def __init__(self):
		super().__init__()
		self.draw()
		rhpy.timer('timestamp', 1.0, self.draw)

	def draw(self):
		with self.draw_context():
			# bottom-right
			now = time.strftime('%H:%M:%S', time.localtime(time.time()))
			extents = self.build_cr.text_extents(now)
			x, y = self.bottom_right(extents)
			self.build_cr.move_to(x, y)
			self.build_cr.show_text(now)

from gst.overlay.overlay import Overlay
import event
import templates
from states import NotifsState
from config import Config


class Notifications(Overlay):
	def __init__(self):
		super().__init__()
		self.line_gap = 20
		self.font_size = 26
		self.set_properties()
		event.subscribe(event.AnyNotificationChange, self.draw, debug_key='ovrly.notif')
		event.subscribe(event.ServiceStarted, self.draw, debug_key='ovrly.notif')

	def draw(self):
		with self.draw_context():
			self.build_cr.save()
			y = 10 # top
			for props in NotifsState.props():
				extents, lines = self.add_line_extents(props.parts.to_lines())
				if props.visible:
					for (line_extents, line) in lines:
						if isinstance(line, templates.Lines.Text):
							x = Config.screen_width - line_extents.width - line_extents.x_bearing - 10
							y_text = y - line_extents.y_bearing
							self.build_cr.move_to(x, y_text)
							for part in line:
								if isinstance(part, templates.Parts.TextProps):
									self.set_properties(font_size=part.size, color=part.color)
								elif isinstance(part, templates.Parts.Text):
									if part.props:
										self.build_cr.save()
										self.set_properties(font_size=part.props.size, color=part.props.color)
									self.build_cr.show_text(part.text)
									if part.props:
										self.build_cr.restore()
						y += line_extents.height
				else:
					y += extents.height
				y += self.line_gap
			self.build_cr.restore()

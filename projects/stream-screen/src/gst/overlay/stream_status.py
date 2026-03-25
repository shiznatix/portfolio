from gst.overlay.color import Color
from gst.overlay.overlay import Overlay

import templates
import event
from shared import RtspStatus
from config import Config

class StreamStatus(Overlay):
	TEMPLATE = '{status:color={status_color},size=40}{:linebreak=15,if=error}{error:color=red,size=32}'

	def __init__(self, name: str):
		super().__init__()
		self.template_parser = templates.TemplateParser(StreamStatus.TEMPLATE)
		self.status: RtspStatus = RtspStatus.NULL
		self.last_error: str | None = None
		self.draw()
		event.subscribe(event.RtspStatusChange, self.on_status_change, name=name)

	def on_status_change(self, pl: event.pload.RtspStatusChange):
		self.status = pl.status
		if pl.status == RtspStatus.ERROR:
			self.last_error = pl.error
		elif pl.status == RtspStatus.PLAYING:
			self.last_error = None
		self.draw()

	def format_template(self):
		status_text = f'{self.status}...'
		status_color = Color.BLACK.name

		if self.status == RtspStatus.PLAYING:
			status_color = Color.GREEN.name
		elif self.status == RtspStatus.NULL:
			status_color = Color.BLACK.name
		elif self.status == RtspStatus.CREATING:
			status_color = Color.YELLOW.name
		elif self.status == RtspStatus.STARTING:
			status_color = Color.ORANGE.name
		elif self.status == RtspStatus.CONNECTED:
			status_color = Color.LIGHT_GREEN.name
		elif self.status == RtspStatus.PAUSED:
			status_text = 'PAUSED'
			status_color = Color.BLUE.name
		elif self.status == RtspStatus.ERROR:
			status_text = 'Error!'
			status_color = Color.RED.name

		return self.template_parser.format(status=status_text, status_color=status_color, error=self.last_error)

	def draw(self):
		with self.draw_context():
			if self.status == RtspStatus.PLAYING:
				return  # don't draw anything if stream is playing
			self.build_cr.save()
			parts = self.format_template()
			extents, lines = self.add_line_extents(parts.to_lines())
			y = (Config.screen_height - extents.height) / 2 # center vertically
			for (line_extents, line) in lines:
				if isinstance(line, templates.Lines.Break):
					pass
				elif isinstance(line, templates.Lines.Text):
					x = (Config.screen_width - line_extents.width) / 2 # center horizontally
					self.build_cr.move_to(x, y)

					for part in line:
						if isinstance(part, templates.Parts.TextProps):
							self.set_properties(color=part.color, font_size=part.size)
						elif isinstance(part, templates.Parts.Text):
							if part.props:
								self.build_cr.save()
								self.set_properties(color=part.props.color, font_size=part.props.size)
							self.build_cr.show_text(part.text)
							if part.props:
								self.build_cr.restore()
				y += line_extents.height
			self.build_cr.restore()

import rhpy
from gst.overlay.overlay import Overlay
from gst.overlay.color import Color
import event
from shared import RtspStatus


class Detections(Overlay):
	def __init__(self, stream_name: str, *, active: bool, enabled: bool):
		super().__init__()
		self.stream_name = stream_name
		self.active = active
		self.status: RtspStatus = RtspStatus.NULL
		if enabled:
			event.subscribe(event.StreamDetectionsChange, self.on_detections_change, name=self.stream_name)
			event.subscribe(event.RtspStatusChange, self.on_status_change, name=self.stream_name)
			event.subscribe(event.ActiveStreamChange, self.on_active_stream_change)

	def on_status_change(self, pl: event.pload.RtspStatusChange):
		self.status = pl.status
		self.draw()

	def on_active_stream_change(self, pl: event.pload.ActiveStream):
		self.active = pl.name == self.stream_name
		self.draw()

	def on_detections_change(self, pl: event.pload.StreamDetections):
		if self.status == RtspStatus.PLAYING and self.active:
			self.draw(pl.detections)

	def draw(self, boxes: list[rhpy.DetectionBox] | None = None):
		with self.draw_context():
			if not boxes:
				return
			self.build_cr.save()
			for box in boxes:
				# Draw bounding box
				Color.GREEN.set(self.build_cr, 1.0)
				self.build_cr.set_line_width(2)
				self.build_cr.rectangle(box.x, box.y, box.w, box.h)
				self.build_cr.stroke()

				# Draw confidence label above the box
				label = f'{int(box.score * 100)}%'
				self.set_properties(font_size=18, color=Color.GREEN)
				ext = self.build_cr.text_extents(label)
				self.build_cr.move_to(
					box.x + box.w - ext.width - ext.x_bearing,
					box.y - ext.height + ext.y_bearing - 4,
				)
				self.build_cr.show_text(label)
			self.build_cr.restore()

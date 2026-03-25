from gst.lib import CairoContext, Gst, cairo
import gst.overlay
from config import Config
from .stream import Stream

ZORDER = 2

class Overlay(Stream):
	TYPE: str = 'overlay'
	src: Gst.Element
	caps: Gst.Element
	cairooverlay: Gst.Element
	bin: Gst.Bin

	def __init__(self, name: str, *, pipeline: Gst.Pipeline, compositor: Gst.Element):
		super().__init__(name, pipeline, compositor)

	def create(self):
		src = Gst.ElementFactory.make('videotestsrc', self.make_element_name('src'))
		caps = Gst.ElementFactory.make('capsfilter', self.make_element_name('caps'))
		cairooverlay = Gst.ElementFactory.make('cairooverlay', self.make_element_name('cairooverlay'))

		if not src or not caps or not cairooverlay:
			raise RuntimeError('Failed to create overlay stream elements')

		self.src = src
		self.caps = caps
		self.cairooverlay = cairooverlay

		# Black pattern at 1fps; _paint clears to transparent before drawing
		self.src.set_property('pattern', 2)  # BLACK
		self.src.set_property('is-live', True)
		self.caps.set_property('caps', Gst.Caps.from_string(
			# f'video/x-raw,format=RGBA'
			# f'video/x-raw,format=BGRA'
			f'video/x-raw'
			f',width={Config.screen_width},height={Config.screen_height}'
			f',framerate={Config.screen_fps}/1'
		))
		self.cairooverlay.connect('draw', self._paint)

		self.bin = Gst.Bin.new(f'{self.name}_overlay_bin')
		for e in (self.src, self.caps, self.cairooverlay):
			self.bin.add(e)
		self.src.link(self.caps)
		self.caps.link(self.cairooverlay)

		src_pad = self.cairooverlay.get_static_pad('src')
		if not src_pad:
			raise RuntimeError('Failed to get cairooverlay src pad')
		self.bin.add_pad(Gst.GhostPad.new('src', src_pad))

		comp_sink = self.compositor.get_request_pad('sink_%u')
		if not comp_sink:
			raise RuntimeError('Failed to get compositor sink pad for overlay')
		self.sink = comp_sink
		self.sink.set_property('zorder', ZORDER)

		# add before linking or the pipeline will fail
		self.pipeline.add(self.bin)

		bin_src = self.bin.get_static_pad('src')
		if not bin_src:
			raise RuntimeError('Failed to get overlay bin src pad')
		bin_src.link(self.sink)

		# sync state after linking
		self.bin.sync_state_with_parent()

	def get_elements(self):
		return [self.src, self.bin, self.caps, self.cairooverlay]

	def _paint(self, _overlay_elem: Gst.Element, cr: CairoContext, _timestamp: int, _duration: int):
		# Clear to fully transparent before painting overlays
		cr.save()
		cr.set_operator(cairo.OPERATOR_SOURCE)
		cr.set_source_rgba(0, 0, 0, 0)
		cr.paint()
		cr.restore()

		gst.overlay.menu_streams.paint(cr)
		gst.overlay.menu_brightness.paint(cr)
		gst.overlay.menu_contrast.paint(cr)
		gst.overlay.active_stream_status().paint(cr)
		gst.overlay.name.paint(cr)
		gst.overlay.timestamp.paint(cr)
		gst.overlay.notifications.paint(cr)
		gst.overlay.active_stream_detections().paint(cr)

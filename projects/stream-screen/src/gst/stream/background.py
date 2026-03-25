from enum import Enum

from gst.lib import Gst
import event
from config import Config, MainSettings
from .stream import Stream

# https://gstreamer.freedesktop.org/documentation/videotestsrc/index.html?gi-language=c#GstVideoTestSrcPattern
class Pattern(Enum):
	SMPTE = 0
	SNOW = 1
	BLACK = 2
	WHITE = 3
	RED = 4
	GREEN = 5
	BLUE = 6
	CHECKERS1 = 7
	CHECKERS2 = 8
	CHECKERS4 = 9
	CHECKERS8 = 10
	CIRCULAR = 11
	BLINK = 12
	SMPTE75 = 13
	ZONE_PLATE = 14
	GAMMA = 15
	CHROMA = 16
	SOLID_COLOR = 17
	BALL = 18
	SMPTE100 = 19
	BAR = 20
	PINWHEEL = 21
	SPOKES = 22
	GRADIENT = 23
	COLORS = 24
	SMPTE_RP219 = 25

FRAMERATE = 5

class Background(Stream):
	TYPE: str = 'background'
	zorder: int
	src: Gst.Element
	caps: Gst.Element
	bin: Gst.Bin

	def __init__(self, name: str, *, pipeline: Gst.Pipeline, compositor: Gst.Element, zorder: int):
		super().__init__(name, pipeline, compositor)
		self._created = False
		self._pattern_for_paused(MainSettings.paused)
		self.zorder = zorder
		event.subscribe(event.PauseChange, self._on_pause)

	def _pattern_for_paused(self, paused: bool):
		self.pattern = Pattern.SMPTE if paused else Pattern.SNOW

	def _on_pause(self, paused: bool):
		self._pattern_for_paused(paused)
		self.set_pattern()

	def create(self):
		src = Gst.ElementFactory.make('videotestsrc', self.make_element_name('src'))
		caps = Gst.ElementFactory.make('capsfilter', self.make_element_name('capsfilter'))

		if not src or not caps:
			raise RuntimeError('Failed to create GStreamer elements')

		self.src = src
		self.caps = caps

		self._created = True
		self.set_pattern()
		self.src.set_property('is-live', True)
		self.caps.set_property('caps', Gst.Caps.from_string(
			'video/x-raw'
			f',width={Config.screen_width},height={Config.screen_height}'
			f',framerate={Config.screen_fps}/1'
		))
		self.bin = Gst.Bin.new(f'{self.name}_bg_bin')
		for e in (self.src, self.caps):
			self.bin.add(e)
		self.src.link(self.caps)

		# ghost pads
		src_pad = self.caps.get_static_pad('src')
		if not src_pad:
			raise RuntimeError('Failed to get caps src pad')
		self.bin.add_pad(Gst.GhostPad.new('src', src_pad))

		sink = self.compositor.get_request_pad('sink_%u')
		if not sink:
			raise RuntimeError('Failed to get compositor sink pad')
		self.sink = sink
		self.sink.set_property('zorder', self.zorder)

		# add before linking `self.sink` or the pipeline will fail
		self.pipeline.add(self.bin)

		bin_src = self.bin.get_static_pad('src')
		if not bin_src:
			raise RuntimeError('Failed to get bin src pad')
		bin_src.link(self.sink)

		# sync state after linking `self.sink` or the pipeline will fail
		self.bin.sync_state_with_parent()

	def set_pattern(self):
		if self._created:
			self.src.set_property('pattern', self.pattern.value)

	def get_elements(self):
		return [
			self.src,
			self.bin,
			self.caps,
		]

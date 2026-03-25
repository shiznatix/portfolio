from __future__ import annotations
import threading
from abc import ABC, abstractmethod
from typing import Optional
import time

import rhpy
from gst.lib import Gst, GLib
import event
from shared import RtspStatus
from .stream import Stream

class Rtsp(Stream, ABC):
	TYPE: str = 'rtsp'

	frame_count: int = 0
	last_fps_time: float = 0.0
	fps_frame_count: int = 0
	last_frame_time: float = 0.0

	zorder: int
	prev_status: RtspStatus = RtspStatus.NULL
	error: str | None = None
	restart_timer: threading.Timer | None = None

	src: Gst.Element
	flip: Gst.Element
	convert: Gst.Element
	balance: Gst.Element
	ghost_sink: Gst.GhostPad
	bin: Gst.Bin
	bin_pad: Gst.Pad
	fakesink: Gst.Element
	fakesink_pad: Gst.Pad

	def __init__(
		self,
		name: str,
		*,
		url: str,
		active: bool,
		show_overlays: bool,
		rotate: int,
		pipeline: Gst.Pipeline,
		compositor: Gst.Element,
		zorder: int,
	):
		super().__init__(name, pipeline, compositor)
		self.url = url
		self.active = active
		self.show_overlays = show_overlays
		self.rotate = rotate
		self.status = RtspStatus.NULL
		self.status_set_time = time.time()
		self.restart_timer = None
		self.elements_lock = threading.RLock()
		self.last_status_emit = None
		self.zorder = zorder
		self.extra_sinks: list[Gst.Element] = []
		event.subscribe(event.BusRtspError, self._on_bus_rtsp_error, name=self.name)
		event.subscribe(event.StreamBalanceChange, self._on_stream_balance_change, name=self.name)

	# def reset_counters(self):
	# 	self.last_frame_time = 0.0
	# 	self.frame_count = 0
	# 	self.fps_frame_count = 0
	# 	self.last_fps_time = 0.0

	def get_fps(self):
		now = time.time()
		if self.last_fps_time == 0.0:
			self.last_fps_time = now
			self.fps_frame_count = 0
			return 0.0

		elapsed = now - self.last_fps_time
		fps = self.fps_frame_count / elapsed if elapsed > 0 else 0.0
		self.last_fps_time = now
		self.fps_frame_count = 0
		return rhpy.round(fps, 1)

	def _on_bus_rtsp_error(self, pl: event.pload.BusRtspError):
		self.on_error(pl.error)

	def _on_stream_balance_change(self, pl: event.pload.StreamBalance):
		self.set_balance(**{ pl.prop: pl.value })

	def set_status(self, status: RtspStatus, error: str | None = None):
		self.prev_status = self.status
		self.status = status
		self.error = error
		self.status_set_time = time.time()
		self.emit_status()

	def emit_status(self):
		if self.last_status_emit == (self.status, self.error):
			return
		event.publish(event.RtspStatusChange, name=self.name, status=self.status, error=self.error)
		self.last_status_emit = (self.status, self.error)
		self.log.info(f'Status change emitted from:{self.prev_status} to:{self.status} error:{self.error}')

	def make_fakesink(self, name: str | None = None) -> tuple[Gst.Element, Gst.Pad]:
		fakesink = Gst.ElementFactory.make('fakesink', name)
		if not fakesink:
			raise RuntimeError('Failed to create fakesink element')
		fakesink.set_property('sync', False)

		sink_pad = fakesink.get_static_pad('sink')
		if not sink_pad:
			raise RuntimeError('Failed to get fakesink sink pad')
		return (fakesink, sink_pad)

	@staticmethod
	def make(
		name: str,
		*,
		encoding: str,
		url: str,
		active: bool,
		show_overlays: bool,
		rotate: int,
		pipeline: Gst.Pipeline,
		compositor: Gst.Element,
		zorder: int,
	) -> Rtsp:
		kwargs = {
			'url': url,
			'active': active,
			'show_overlays': show_overlays,
			'rotate': rotate,
			'pipeline': pipeline,
			'compositor': compositor,
			'zorder': zorder,
		}
		if encoding == 'jpeg':
			return RtspJpeg(name, **kwargs)
		return RtspH264(name, **kwargs)

	@abstractmethod
	def _create_decode_elements(self) -> tuple[Gst.Element, Gst.Element]:
		...

	@abstractmethod
	def _get_decode_elements(self) -> list[Gst.Element]:
		...

	def create(self):
		src = Gst.ElementFactory.make('rtspsrc', self.make_element_name('rtspsrc'))
		flip = Gst.ElementFactory.make('videoflip', self.make_element_name('flip'))
		convert = Gst.ElementFactory.make('videoconvert', self.make_element_name('conv'))
		balance = Gst.ElementFactory.make('videobalance', self.make_element_name('balance'))

		if not src or not flip or not convert or not balance:
			raise RuntimeError('Failed to create GStreamer elements')

		self.set_status(RtspStatus.CREATING)
		self.src = src
		self.flip = flip
		self.convert = convert
		self.balance = balance
		self.src.set_property('location', self.url)
		self.src.set_property('latency', 100)
		self.src.set_property('protocols', 'udp') # tcp
		if self.rotate:
			rotate = 'counterclockwise' if self.rotate == 90 else 'clockwise' if self.rotate == 270 else f'rotate-{self.rotate}'
			self.flip.set_property('method', rotate)
		self.balance.set_property('brightness', 0.0)
		self.balance.set_property('contrast', 1.0)

		self.bin = Gst.Bin.new(f'{self.name}_bin')
		for e in (self.flip, self.balance, self.convert):
			self.bin.add(e)
		self.flip.link(self.balance)
		self.balance.link(self.convert)

		# subclass builds its decode chain inside self.bin
		first_decode, last_decode = self._create_decode_elements()
		last_decode.link(self.flip)

		# ghost sink into the first decode element
		depay_sink_pad = first_decode.get_static_pad('sink')
		if not depay_sink_pad:
			raise RuntimeError('Failed to get depay sink pad')
		self.ghost_sink = Gst.GhostPad.new('sink', depay_sink_pad)
		self.bin.add_pad(self.ghost_sink)

		# ghost src (raw video out of the bin)
		src_pad = self.convert.get_static_pad('src')
		if not src_pad:
			raise RuntimeError('Failed to get convert src pad')
		ghost_src = Gst.GhostPad.new('src', src_pad)
		self.bin.add_pad(ghost_src)

		ghost_src.add_probe(Gst.PadProbeType.EVENT_DOWNSTREAM, self._ghost_src_pad_probe)
		self.src.connect('pad-added', self._on_pad_added)
		# fakesink for holding the stream until it is producing frames
		self.fakesink, self.fakesink_pad = self.make_fakesink(self.make_element_name('fakesink'))

		# elements and bin *must* be added before linking to bin
		self.pipeline.add(self.src)
		self.pipeline.add(self.bin)
		self.pipeline.add(self.fakesink)
		# now we can link the bin
		bin_pad = self.bin.get_static_pad('src')
		if not bin_pad:
			raise RuntimeError('Failed to get bin src pad')
		self.bin_pad = bin_pad
		self.bin_pad.add_probe(Gst.PadProbeType.BUFFER, self._on_buffer)
		self.bin_pad.link(self.fakesink_pad)

		self.src.sync_state_with_parent()
		self.bin.sync_state_with_parent()
		self.fakesink.sync_state_with_parent()
		self.set_status(RtspStatus.STARTING)

	def cleanup(self):
		super().cleanup()
		self.extra_sinks.clear()
		self.set_status(RtspStatus.NULL)

	def pause(self):
		self.set_elements_state(Gst.State.PAUSED)
		self.set_status(RtspStatus.PAUSED)

	def on_error(self, error: str):
		if self.status == RtspStatus.ERROR:
			return
		# Lock state so pipeline.set_state(PLAYING) won't re-push these elements
		for element in [self.src, self.bin, self.fakesink]:
			element.set_locked_state(True)
		# Stop rtspsrc first — it has an internal retry loop that keeps firing bus errors
		self.src.set_state(Gst.State.NULL)
		self.set_elements_state(Gst.State.NULL)
		self.set_status(RtspStatus.ERROR, error)

	def restart(self):
		with self.elements_lock:
			if self.restart_timer:
				self.restart_timer.cancel()
				self.restart_timer = None

			self.cleanup()
			self.create()

	def schedule_restart(self, delay_secs: float = 5.0, *, overwrite: bool = False):
		if not self.elements_lock.acquire(blocking=False):
			self.log.dup_error('Rtsp elements are locked, skipping schedule restart', interval=7)
			return

		try:
			if self.restart_timer and not overwrite:
				self.log.debug('RTSP restart already scheduled, skipping')
				return

			if self.restart_timer and overwrite:
				self.restart_timer.cancel()
				self.restart_timer = None
				self.log.info('Overwriting existing RTSP restart timer')

			self.restart_timer = threading.Timer(delay_secs, self.restart)
			self.restart_timer.start()
			self.log.info('Scheduling RTSP restart')
		finally:
			self.elements_lock.release()

	def get_elements(self):
		return [
			self.src,
			self.bin,
			*self._get_decode_elements(),
			self.flip,
			self.balance,
			self.convert,
			self.fakesink,
			*self.extra_sinks,
		]

	def set_balance(self, *, brightness: Optional[float] = None, contrast: Optional[float] = None):
		if not self.balance:
			return
		if brightness is not None:
			self.balance.set_property('brightness', brightness)
		if contrast is not None:
			self.balance.set_property('contrast', contrast)

	def connect_to_compositor(self):
		def probe(pad: Gst.Pad, info: Gst.PadProbeInfo):
			if not info.type & Gst.PadProbeType.BLOCK_DOWNSTREAM:
				return Gst.PadProbeReturn.REMOVE

			# Running on the streaming thread between buffers — safe to rewire
			comp_sink = self.compositor.get_request_pad('sink_%u')
			if not comp_sink:
				self.log.error('Failed to get compositor sink pad')
				GLib.idle_add(lambda: self.on_error('Compositor link failed'))
				return Gst.PadProbeReturn.REMOVE

			# Swap pad destination atomically on the streaming thread
			comp_sink.set_property('zorder', self.zorder)
			pad.unlink(self.fakesink_pad)
			pad.link(comp_sink)
			self.sink = comp_sink
			self.log.info('Connected to compositor')
			return Gst.PadProbeReturn.REMOVE
		self.bin_pad.add_probe(Gst.PadProbeType.BLOCK_DOWNSTREAM, probe)

	def disconnect_from_compositor(self):
		if self.sink is None:
			self.log.debug('Not connected to compositor, skipping disconnect')
			return

		def probe(pad: Gst.Pad, info: Gst.PadProbeInfo):
			if not info.type & Gst.PadProbeType.BLOCK_DOWNSTREAM:
				return Gst.PadProbeReturn.REMOVE
			if self.sink is None:
				return Gst.PadProbeReturn.REMOVE

			old_comp_sink = self.sink
			self.sink = None
			pad.unlink(old_comp_sink)
			pad.link(self.fakesink_pad)

			def release_compositor_pad():
				self.compositor.release_request_pad(old_comp_sink)
				self.log.info('Disconnected from compositor')
				return False
			GLib.idle_add(release_compositor_pad)
			return Gst.PadProbeReturn.REMOVE
		self.bin_pad.add_probe(Gst.PadProbeType.BLOCK_DOWNSTREAM, probe)

	# callbacks
	def _ghost_src_pad_probe(self, _pad: Gst.Pad, info: Gst.PadProbeInfo):
		if not info.type & Gst.PadProbeType.EVENT_DOWNSTREAM:
			return Gst.PadProbeReturn.OK

		evnt = info.get_event()
		if evnt and evnt.type == Gst.EventType.EOS:
			self.log.error('EOS detected on pad')
			GLib.idle_add(lambda: self.on_error('EOS'))
		return Gst.PadProbeReturn.OK

	def _on_pad_added(self, src_elem: Gst.Element, pad: Gst.Pad):
		self.log.info(f'New pad {pad.get_name()} from {src_elem.get_name()}')
		caps = pad.get_current_caps()
		s = caps.get_structure(0) if caps else None
		mime = s.get_name() if s else 'None'
		media = s.get_string('media') if s else 'None'
		encoding = s.get_string('encoding-name') if s else 'None'
		is_video = mime == 'application/x-rtp' and media == 'video'

		if not is_video:
			self.log.info('Non-video RTP pad, consuming with fakesink', extra={
				'mime': mime, 'media': media, 'encoding': encoding,
			})
			# Consume non-video pads (e.g. audio) so rtspsrc doesn't error with not-linked
			fakesink, sink_pad = self.make_fakesink()
			self.pipeline.add(fakesink)
			pad.link(sink_pad)
			fakesink.sync_state_with_parent()
			self.extra_sinks.append(fakesink)
		elif self.ghost_sink.is_linked():
			self.log.info('RTSP video pad already linked, ignoring')
		elif pad.link(self.ghost_sink) != Gst.PadLinkReturn.OK:
			self.log.error(f'Failed to link {encoding} video pad to depay')
			GLib.idle_add(lambda: self.on_error('Link failed'))
		else:
			self.set_status(RtspStatus.CONNECTED)

	def _on_buffer(self, _pad: Gst.Pad, _info: Gst.PadProbeInfo):
		self.frame_count += 1
		self.fps_frame_count += 1
		self.last_frame_time = time.time()

		if self.frame_count > 5 and self.active and not self.sink:
			self.connect_to_compositor()
		elif self.frame_count > 5:
			self.set_status(RtspStatus.PLAYING)
		return Gst.PadProbeReturn.OK


class RtspH264(Rtsp):
	depay: Gst.Element
	queue1: Gst.Element
	parse: Gst.Element
	decoder: Gst.Element
	queue2: Gst.Element

	def _create_decode_elements(self) -> tuple[Gst.Element, Gst.Element]:
		depay = Gst.ElementFactory.make('rtph264depay', self.make_element_name('depay'))
		queue1 = Gst.ElementFactory.make('queue', self.make_element_name('q1'))
		parse = Gst.ElementFactory.make('h264parse', self.make_element_name('parse'))
		decoder = Gst.ElementFactory.make('avdec_h264', self.make_element_name('dec'))
		queue2 = Gst.ElementFactory.make('queue', self.make_element_name('q2'))
		if not depay or not queue1 or not parse or not decoder or not queue2:
			raise RuntimeError('Failed to create H264 decode elements')

		self.depay = depay
		self.queue1 = queue1
		self.parse = parse
		self.decoder = decoder
		self.queue2 = queue2
		for e in (depay, queue1, parse, decoder, queue2):
			self.bin.add(e)

		depay.link(queue1)
		queue1.link(parse)
		parse.link(decoder)
		decoder.link(queue2)
		return (depay, queue2)

	def _get_decode_elements(self) -> list[Gst.Element]:
		return [self.depay, self.queue1, self.parse, self.decoder, self.queue2]


class RtspJpeg(Rtsp):
	depay: Gst.Element
	decoder: Gst.Element

	def _create_decode_elements(self) -> tuple[Gst.Element, Gst.Element]:
		depay = Gst.ElementFactory.make('rtpjpegdepay', self.make_element_name('depay'))
		decoder = Gst.ElementFactory.make('jpegdec', self.make_element_name('dec'))
		if not depay or not decoder:
			raise RuntimeError('Failed to create JPEG decode elements')

		self.depay = depay
		self.decoder = decoder
		for e in (depay, decoder):
			self.bin.add(e)

		depay.link(decoder)
		return (depay, decoder)

	def _get_decode_elements(self) -> list[Gst.Element]:
		return [self.depay, self.decoder]

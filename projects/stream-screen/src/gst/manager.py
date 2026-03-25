import time

import rhpy

from gst.stream.stream import Stream
from gst.lib import Gst, GLib
from gst.stream import RtspStream, BackgroundStream, OverlayStream

import event
from states import ActiveState
from shared import RtspStatus
from config import Config

class SourceManager():
	def __init__(self, pipeline: Gst.Pipeline, compositor: Gst.Element):
		self.log = rhpy.logs('mngr')
		self.streams: list[Stream] = []
		self.rtsps: list[RtspStream] = []
		self.pipeline = pipeline
		self.compositor = compositor

		# register cleanup early in case something fails
		rhpy.on_quit(self.cleanup)

		self.background = BackgroundStream(
			'background',
			pipeline=pipeline,
			compositor=compositor,
			zorder=0,
		)
		self.background.create()
		self.streams.append(self.background)

		for stream in Config.streams:
			rtsp = RtspStream.make(
				stream.name,
				encoding=stream.encoding,
				url=stream.url,
				active=(ActiveState.stream == stream),
				show_overlays=stream.overlays,
				rotate=stream.rotate,
				pipeline=pipeline,
				compositor=compositor,
				zorder=1,
			)
			if rtsp.active or stream.connect_on_start:
				rtsp.create()
				# TODO - if the stream is not connected on start, the brightness and constrast are not applied
				rtsp.set_balance(brightness=stream.brightness, contrast=stream.contrast)
			self.streams.append(rtsp)
			self.rtsps.append(rtsp)

		self.overlay = OverlayStream(
			'overlay',
			pipeline=pipeline,
			compositor=compositor,
		)
		self.overlay.create()
		self.streams.append(self.overlay)

		self.bus = pipeline.get_bus()
		self.bus.add_signal_watch()
		self._bus_error_id = self.bus.connect('message::error', self._on_bus_error)
		self._bus_eos_id = self.bus.connect('message::eos', self._on_bus_eos)

		event.subscribe(event.ActiveStreamChange, self._on_active_stream_change)
		GLib.timeout_add(500, self._sync_stream_states)

	# Callbacks
	def cleanup(self):
		self.log.info('Cleaning up SourceManager')
		for stream in self.streams:
			try:
				stream.cleanup()
				self.log.info(f'Cleaned up stream {stream.name}', extra={
					'non_null_elems': stream.get_elements_states(without_state=Gst.State.NULL),
				})
			except Exception as e:
				self.log.error(f'Error cleaning up stream {stream.name}: {e}')

		if hasattr(self, 'bus'):
			if self._bus_error_id:
				self.bus.disconnect(self._bus_error_id)
			if self._bus_eos_id:
				self.bus.disconnect(self._bus_eos_id)
			self.bus.remove_signal_watch()

	def _on_active_stream_change(self, pl: event.pload.ActiveStream):
		if not rhpy.running():
			return
		for rtsp in self.rtsps:
			rtsp.active = rtsp.name == pl.name
			if rtsp.active:
				if rtsp.status in [RtspStatus.NULL, RtspStatus.ERROR]:
					rtsp.restart()
				else:
					rtsp.set_elements_state(Gst.State.PLAYING)
			else:
				rtsp.disconnect_from_compositor()

	def _on_bus_rtsp_error(self, src_name: str, error: str):
		if not rhpy.running():
			return
		name = src_name.split('_')[0]
		event.publish(event.BusRtspError, name=name, error=error)

	def _on_bus_error(self, _bus: Gst.Bus, msg: Gst.Message):
		if not rhpy.running():
			return False
		err, dbg = msg.parse_error()
		src_name = (msg.src.get_name() if msg.src else None) or ''
		parent = msg.src.get_parent() if msg.src else None
		parent_name = (parent.get_name() if parent else None) or ''
		rtsp_name = src_name if 'rtspsrc' in src_name else parent_name if 'rtspsrc' in parent_name else None
		self.log.error(f'Bus error from {src_name}: {err.message}')#, {'debug': dbg})

		if rtsp_name:
			parsed_error = dbg.splitlines().pop().split('. ')[0].strip()
			self._on_bus_rtsp_error(rtsp_name, parsed_error)
		else:
			self.log.warning('Non-RTSP error, stopping pipeline', extra={'debug': dbg})
			for stream in self.streams:
				stream.set_elements_state(Gst.State.NULL)
			self.pipeline.set_state(Gst.State.NULL)

	def _on_bus_eos(self, _bus: Gst.Bus, msg: Gst.Message):
		if not rhpy.running():
			return False
		src_name = msg.src.get_name() if msg.src else 'unknown'
		if src_name and 'rtspsrc' in src_name:
			self.log.warning(f'Bus rtspsrc {src_name} EOS')
			self._on_bus_rtsp_error(src_name, 'EOS')
		else:
			self.log.warning(f'Bus EOS from {src_name}, shutting down...')
			self.pipeline.set_state(Gst.State.NULL)

	def _sync_stream_states(self):
		if not rhpy.running():
			return False
		self.background.sync_state_with_parent()
		self.overlay.sync_state_with_parent()

		if ActiveState.paused:
			for rtsp in self.rtsps:
				if rtsp.status not in [RtspStatus.PAUSED, RtspStatus.ERROR]:
					rtsp.pause()
			return True

		for rtsp in self.rtsps:
			if rtsp.active:
				if rtsp.status not in [RtspStatus.PLAYING, RtspStatus.ERROR] and time.time() - rtsp.status_set_time > 10:
					rtsp.on_error('Status Timeout')
				elif rtsp.status == RtspStatus.PLAYING and time.time() - rtsp.last_frame_time > 10:
					rtsp.on_error('Frames Timeout')
				if rtsp.status == RtspStatus.ERROR:
					rtsp.schedule_restart()
				else:
					rtsp.sync_state_with_parent()
			# else:
			# 	rtsp.reset_counters()
		return True
import rhpy

from gst.lib import Gst, GLib
import gst.sink
from gst.manager import SourceManager

from states import ActiveState
from config import Config

log = rhpy.logs('gst')

def run():
	pipeline = None

	try:
		Gst.init(None)

		# Main pipeline
		pipeline = Gst.Pipeline.new('pipeline')

		if Config.screen_type == 'framebuffer':
			screen_sink = gst.sink.framebuffer()
		elif Config.screen_type == 'kms':
			screen_sink = gst.sink.kms()
		else:
			screen_sink = gst.sink.spi_tft()

		compositor = Gst.ElementFactory.make('compositor', 'comp')
		videorate = Gst.ElementFactory.make('videorate', 'videorate')
		videoflip = Gst.ElementFactory.make('videoflip', 'flip')
		convert = Gst.ElementFactory.make('videoconvert', 'convert')
		queue = Gst.ElementFactory.make('queue', 'queue')

		if not pipeline or not screen_sink or not compositor or not videorate or not videoflip or not convert or not queue:
			raise RuntimeError('Failed to create main GStreamer elements')

		videorate.set_property('max-rate', Config.screen_fps)
		if Config.screen_rotate:
			rotate = 'counterclockwise' if Config.screen_rotate == 90 else 'clockwise' if Config.screen_rotate == 270 else f'rotate-{Config.screen_rotate}'
			videoflip.set_property('method', rotate)
		queue.set_property('max-size-buffers', 1)
		queue.set_property('leaky', 2)  # 2 = leak downstream (drop old buffers)
		# compositor.set_property('background', 1)

		pipeline.add(compositor)
		pipeline.add(videorate)
		pipeline.add(videoflip)
		pipeline.add(convert)
		pipeline.add(queue)
		pipeline.add(screen_sink)
		compositor.link(videorate)
		videorate.link(videoflip)
		videoflip.link(convert)
		convert.link(queue)
		queue.link(screen_sink)

		manager = SourceManager(pipeline, compositor)
		pipeline.set_state(Gst.State.PLAYING)

		loop = GLib.MainLoop()

		def keep_pipeline_playing():
			if not rhpy.running():
				loop.quit()
				return False
			state = pipeline.get_state(0)[1]
			if state != Gst.State.PLAYING:
				log.dup_error(f'Pipeline not playing: {state.value_nick}, starting', interval=10)
				pipeline.set_state(Gst.State.PLAYING)
			return True

		def log_state():
			# if not rhpy.running():
			if not rhpy.perf_enabled() or not rhpy.running():
				return True
			pipeline_state = pipeline.get_state(0)[1].value_nick
			log.info(f'[pipeline] {pipeline_state} | [wanted] {ActiveState.stream.name}')

			for rtsp in manager.rtsps:
				name = f'*{rtsp.name}*' if rtsp.active else rtsp.name
				states = rtsp.get_states_stats()
				log.info(f'  {name} RTSP fps:{rtsp.get_fps()}({rtsp.frame_count}) {rtsp.status} {states}')
			return True

		def cleanup():
			log.info('Cleaning up GST pipeline')
			pipeline.set_state(Gst.State.NULL)
			pipeline.get_state(timeout=Gst.SECOND * 5)
			loop.quit()
		rhpy.on_quit(cleanup)

		if rhpy.running():
			GLib.timeout_add_seconds(60, log_state)
			GLib.timeout_add_seconds(1, keep_pipeline_playing)
			loop.run()
	except Exception as e:
		rhpy.quit(error=e, message=str(e))
		log.error(f'Error in GST pipeline: {e}')
	finally:
		rhpy.quit()
		log.info('GST pipeline stopped')

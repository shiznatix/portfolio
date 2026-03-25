import threading

import rhpy.web

import splash
import gst.pipeline
import event
import event.emitter
import handlers
from config import Config, MainSettings

class Lifecycle:
	log = rhpy.logs('main')
	pipeline_thread: threading.Thread | None = None

	def init(self) -> None:
		event.stats.init()
		splash.show(text='Hello!', bg_color=rhpy.rgb.BLUE, text_color=rhpy.rgb.GREEN)

		self.pipeline_thread = rhpy.thread(gst.pipeline.run, name='gst_pipeline')
		rhpy.thread(event.emitter.run, name='event_emitter')
		handlers.register_redis_handlers()

		event.publish(event.ServiceStarted, event.pload.ServiceStarted(paused=MainSettings.paused))

		# rhpy.filter_logs('Status change emitted', inclusive=False)
		# rhpy.filter_logs('Bus error', inclusive=False)

	def cleanup(self) -> None:
		self.log.info('Lifecycle cleanup')
		if not self.pipeline_thread:
			splash.show(text='Stopped', bg_color=rhpy.rgb.PINK, text_color=rhpy.rgb.WHITE)

	def final(self) -> None:
		self.log.info('Lifecycle final')
		result = rhpy.result()
		msg = result.message or result.error or 'Goodbye!'
		colors = result.code == 0 and (rhpy.rgb.CYAN, rhpy.rgb.ORANGE) or (rhpy.rgb.RED, rhpy.rgb.BLACK)
		splash.show(text=str(msg), bg_color=colors[0], text_color=colors[1])

if __name__ == '__main__':
	lifecycle = Lifecycle()
	rhpy.web.run(
		Config,
		http_routes=handlers.router,
		init=lifecycle.init,
		cleanup=lifecycle.cleanup,
		final=lifecycle.final,
		# debugging
		# monitor_performance=True,
		# log_level=rhpy.WARNING,
	)

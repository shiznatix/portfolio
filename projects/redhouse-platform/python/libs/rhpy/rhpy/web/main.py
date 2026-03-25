from contextlib import asynccontextmanager
import asyncio
import os
import signal
from typing import Callable, Type

import uvicorn
import prometheus_client

from .. import config as conf
from ..funcs import network_info, service_name
from ..threads import _threads as threads
from ..timers import _timers as timers
from ..lifecycle import _lifecycle as lifecycle
from .. import logger
from .. import performance
from . import server

log = logger.get('web.main')

def create_app(
	routes: server.RouteDecorators | None = None,
	*,
	init: Callable[[], None] | None = None,
	cleanup: Callable[[], None] | None = None,
	final: Callable[[], None] | None = None,
):
	ports = conf.ports()

	@asynccontextmanager
	async def lifespan(_app):
		watcher: asyncio.Task | None = None

		try:
			async def _watch_threads_quit() -> None:
				await asyncio.to_thread(lifecycle.wait)
				log.info('Thread quit event set, shutting down server')
				os.kill(os.getpid(), signal.SIGTERM)
			watcher = asyncio.create_task(_watch_threads_quit())

			conf.print_all_configs()
			if init:
				init()

			hostname, ips = network_info()
			service = service_name()
			print('')
			print('\n' + '=' * 5 + f' {service} ' + '=' * 5)
			for ip in ips:
				print(f'|  http://{ip}:{ports.http}')
			print(f'|  http://{hostname}.rh:{ports.http}')
			print('\n' + '=' * 5 + f' {service} ' + '=' * 5)

			threads.start_all()
			timers.start()

			yield
		except Exception as e:
			log.exception(e)
			lifecycle.quit(exit_code=os.EX_DATAERR, error=e)
		finally:
			log.info('Cleanup and shutdown')
			lifecycle.quit()
			if watcher:
				lifecycle.quit_if_fail(watcher.cancel)
			# dont wait for in-flight ctx.thread() threads — they are daemon threads
			lifecycle.quit_if_fail(lambda: server.ctx_executor.shutdown(wait=False, cancel_futures=False))
			if cleanup:
				lifecycle.quit_if_fail(cleanup)
			lifecycle.quit_if_fail(threads.join)
			if final:
				lifecycle.quit_if_fail(final)
			lifecycle.run_quit_callbacks()

			result = lifecycle.result()
			log.info(f'Shutdown complete with result: {result}')
			if result.code != 0:
				raise SystemExit(result)

	asgi_app = server.create_asgi_app(routes=routes, lifespan=lifespan)
	metrics_app = prometheus_client.make_asgi_app()
	asgi_app.mount('/metrics', metrics_app)

	return asgi_app


def run(
	config: conf.Config | Type[conf.Config] | None = None,
	*,
	init: Callable[[], None] | None = None,
	cleanup: Callable[[], None] | None = None,
	final: Callable[[], None] | None = None,
	http_routes: server.RouteDecorators | None = None,
	monitor_performance: bool = False,
	log_level: int | None = None,
):
	if monitor_performance:
		performance.enable()
	if config is not None:
		conf.register(config)
	if log_level is not None:
		logger.set_global_level(log_level)

	ports = conf.ports()
	app_instance = create_app(routes=http_routes, init=init, cleanup=cleanup, final=final)
	uvicorn.run(
		app_instance,
		host='0.0.0.0',
		port=ports.http,
		timeout_graceful_shutdown=1,
		access_log=False,
	)

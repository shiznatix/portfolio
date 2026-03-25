import os
import sys
from typing import Callable, Type

from . import config as conf
from .threads import _threads as threads
from .timers import _timers as timers
from .lifecycle import _lifecycle as lifecycle
from . import logger
from . import performance

def run(
	config: conf.Config | Type[conf.Config] | None = None,
	*,
	init: Callable[[], None] | None = None,
	cleanup: Callable[[], None] | None = None,
	final: Callable[[], None] | None = None,
	monitor_performance: bool = False,
	log_level: int | None = None,
):
	if log_level is not None:
		logger.set_global_level(log_level)
	log = logger.get('main')

	try:
		if monitor_performance:
			performance.enable()
		if config is not None:
			conf.register(config)

		lifecycle.register_handler()
		conf.print_all_configs()

		if init:
			init()
		threads.start_all()
		timers.start()

		lifecycle.wait()
	except Exception as e:
		log.exception(e)
		lifecycle.quit(exit_code=os.EX_DATAERR, error=e)
	finally:
		log.info('Cleanup and shutdown')
		lifecycle.quit()
		if cleanup:
			lifecycle.quit_if_fail(cleanup)
		lifecycle.quit_if_fail(threads.join)
		if final:
			lifecycle.quit_if_fail(final)
		lifecycle.run_quit_callbacks()

		result = lifecycle.result()
		log.info(f'Exiting code:{result.code}, message: {result.message}, error: {result.error}')
		sys.exit(result.code)

from __future__ import annotations
import logging as _logging
import threading
from typing import Callable

from logfmter import Logfmter

_handler = _logging.StreamHandler()
_handler.setFormatter(Logfmter(
	keys=['level', 'name'],
	mapping={'level': 'levelname'},
))
_logging.basicConfig(handlers=[_handler], level=_logging.INFO, force=True)

DEBUG = _logging.DEBUG
INFO = _logging.INFO
WARNING = _logging.WARNING
ERROR = _logging.ERROR

class Logger(_logging.Logger):
	class DupsManager:
		def __init__(self, msg: str, logger: Logger, delay: float, on_flush: Callable[[str], None]):
			from . import timers  # pylint: disable=import-outside-toplevel
			from . import lifecycle  # pylint: disable=import-outside-toplevel

			self.msg = msg
			self.log = logger
			self.delay = delay
			self.count = 1
			self.flushed = False
			self.lock = threading.RLock()
			self.on_flush = on_flush
			self.timer = timers.Timer(
				name=f'logger_dup_flush_{self.log.name}_{abs(hash(self.msg))}',
				delay=self.delay,
				callback=self.flush,
				start=True
			)
			self.on_quit_key = lifecycle.on_quit(self.flush)

		def increment(self):
			with self.lock:
				self.count += 1

		def flush(self):
			from . import lifecycle  # pylint: disable=import-outside-toplevel

			with self.lock:
				if self.flushed:
					return
				self.flushed = True

				if self.timer:
					self.timer.cancel()
					self.timer = None

				self.log.error(f'{self.msg} (x{self.count} times)')
				if self.on_quit_key:
					lifecycle.remove_on_quit(self.on_quit_key)
					self.on_quit_key = None
				self.on_flush(self.msg)

	def __init__(self, name: str, level: int = _logging.NOTSET):
		super().__init__(name, level)
		self._dups_manager: dict[str, Logger.DupsManager] = {}
		self._managers_lock = threading.RLock()

	def dup_error(self, msg: str, *, interval: float = 15.0):
		with self._managers_lock:
			if msg not in self._dups_manager:
				# first error of this type, log immediately
				self.error(msg)
				def on_flush(msg: str):
					with self._managers_lock:
						self._dups_manager.pop(msg, None)
				self._dups_manager[msg] = Logger.DupsManager(msg, self, interval, on_flush)
			else:
				self._dups_manager[msg].increment()

_logging.setLoggerClass(Logger)

class _Filter(_logging.Filter):
	def __init__(self, search_str: str, inclusive = True):
		super().__init__()
		self.search_str = search_str
		self.inclusive = inclusive
	def filter(self, record: _logging.LogRecord) -> bool:
		matches = self.search_str in record.name or self.search_str in record.msg
		return matches if self.inclusive else not matches

def get(name: str, level: int = INFO) -> Logger:
	log = _logging.getLogger(name)
	if not isinstance(log, Logger):
		raise TypeError(f'Logger "{name}" is not an instance of rhpy.logger.Logger')
	log.setLevel(level)
	return log

def set_global_level(level: int):
	_logging.root.setLevel(level)
	for logger in _logging.Logger.manager.loggerDict.values():
		if isinstance(logger, _logging.Logger):
			logger.setLevel(level)
	print(f'Global log level set to {level}')

def filter_logs(search_str: str, inclusive: bool = True):
	fltr = _Filter(search_str, inclusive)
	_handler.addFilter(fltr)

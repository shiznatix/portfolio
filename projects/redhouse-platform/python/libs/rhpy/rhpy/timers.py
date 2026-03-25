from typing import Callable
import threading

from . import logger
from . import lifecycle


class Timer:
	def __init__(self, *, name: str, delay: float | None, callback: Callable, start: bool):
		self.name = name
		self.log = logger.get(f'timer.{name}')
		self._delay = delay
		self._callback = callback
		self._timer: threading.Timer | None = None
		self._was_canceled = False
		self._lock = threading.RLock()
		if start:
			self.start()

	def set_delay(self, delay: float):
		with self._lock:
			self._delay = delay
			if self._timer:
				self._cleanup()
				self.start()

	def start(self, *, quiet: bool = False):
		with self._lock:
			if self._delay is None:
				if not quiet:
					self.log.warning('Cannot start timer with no delay set')
				return
			if self._timer:
				if not quiet:
					self.log.warning('Timer already started')
				return
			self._was_canceled = False
			self._timer = threading.Timer(self._delay, self._on_trigger)
			self._timer.start()

	def restart(self, *, quiet: bool = False):
		with self._lock:
			self._cleanup()
			self.start(quiet=quiet)

	def cancel(self):
		with self._lock:
			self._cleanup()
			self._was_canceled = True
			self.log.debug('Cancelled timer')

	def is_active(self):
		with self._lock:
			return self._timer is not None

	def _cleanup(self):
		with self._lock:
			if self._timer:
				self._timer.cancel()
			self._timer = None

	def _on_trigger(self):
		with self._lock:
			self._cleanup()
			self._callback()
			if not self._was_canceled:
				self.start()

class Timers:
	def __init__(self):
		self._ready_pending_starts: list[Timer] = []
		self._timers: list[Timer] = []
		self._ready = False
		self._closed = False
		self._lock = threading.RLock()
		lifecycle.on_quit(self.cleanup)

	def start(self):
		with self._lock:
			if self._ready or self._closed:
				return
			for t in self._ready_pending_starts:
				t.start()
			self._ready = True
			self._ready_pending_starts = []

	def add(self, name: str, delay: float | None, callback: Callable, start: bool = True):
		with self._lock:
			if self._closed:
				raise RuntimeError('Cannot add timers after closing')

			want_start = (start and delay is not None)
			start_on_ready = (not self._ready and want_start)
			start = want_start and not start_on_ready

			t = Timer(name=name, delay=delay, callback=callback, start=start)
			self._timers.append(t)
			if start_on_ready:
				self._ready_pending_starts.append(t)

			return t

	def cleanup(self):
		with self._lock:
			for t in self._timers:
				t.cancel()
			self._timers = []
			self._closed = True

_timers = Timers()
def timer(name: str, delay: float | None, callback: Callable, start: bool = True) -> Timer:
	return _timers.add(name=name, delay=delay, callback=callback, start=start)

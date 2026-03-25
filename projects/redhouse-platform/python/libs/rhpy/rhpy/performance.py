from contextlib import contextmanager
import inspect
import threading
import time

from . import logger


log = logger.get('perf')

class _Perf:
	def __init__(self):
		self._enabled = False
		self._timings: dict[str, float] = {}

	def enable(self):
		self._enabled = True

	def enabled(self) -> bool:
		return self._enabled

	def _auto_key(self) -> str:
		# 0=_auto_key, 1=perf generator frame, 2=_GeneratorContextManager.__enter__, 3=actual caller
		stack = inspect.stack()
		if len(stack) <= 3:
			return 'unknown'
		frame_info = stack[3]
		func_name = frame_info.function
		local_self = frame_info.frame.f_locals.get('self')
		if local_self is not None:
			return f'{type(local_self).__name__}.{func_name}'
		return func_name

	@contextmanager
	def perf(self, *, threshold: float | None = 0.1, key: str | None = None, force: bool = False):
		if not self._enabled and not force:
			yield
			return

		resolved_key = key if key is not None else self._auto_key()
		t0 = time.perf_counter()
		try:
			yield
		finally:
			elapsed = time.perf_counter() - t0
			if threshold is None:
				log.info(f'Elapsed [{resolved_key}] {elapsed * 1000:.1f}ms')
			elif elapsed > threshold:
				log.warning(f'SLOW [{resolved_key}] took {elapsed * 1000:.1f}ms (> {threshold * 1000:.0f}ms)')

	def start(self, key: str, force: bool = False):
		if not self._enabled and not force:
			return
		self._timings[key] = time.perf_counter()

	def end(self, key: str, force: bool = False):
		if not self._enabled and not force:
			return
		start_time = self._timings.pop(key, None)
		if start_time is None:
			# log.warning(f'No start time found for key: {key}')
			return
		elapsed = time.perf_counter() - start_time
		log.info(f'Elapsed [{key}] {elapsed * 1000:.1f}ms')

_perf = _Perf()
def enable():
	_perf.enable()
def perf_enabled() -> bool:
	return _perf.enabled()
def perf_start(key: str, force: bool = False):
	return _perf.start(key, force)
def perf_end(key: str, force: bool = False):
	return _perf.end(key, force)
def perf(*, threshold: float | None = 0.1, key: str | None = None, force: bool = False):
	return _perf.perf(threshold=threshold, key=key, force=force)

class PerfLock:
	def __init__(self, name: str, *, rlock: bool = False, threshold: float = 0.1):
		self._name = name
		self._lock = threading.RLock() if rlock else threading.Lock()
		self._threshold = threshold

	def acquire(self, blocking: bool = True, timeout: float = -1) -> bool:
		with perf(threshold=self._threshold, key=f'{self._name} lock'):
			result = self._lock.acquire(blocking, timeout) if timeout >= 0 else self._lock.acquire(blocking)
		return result

	def release(self) -> None:
		self._lock.release()

	def __enter__(self):
		self.acquire()
		return self

	def __exit__(self, *_):
		self.release()

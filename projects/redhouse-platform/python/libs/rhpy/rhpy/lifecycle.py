import dataclasses
from dataclasses import dataclass
import os
import secrets
import signal
import threading
from typing import Any, Callable

from . import logger

log = logger.get('lifecycle')

class _Lifecycle:
	@dataclass
	class Result:
		code: int = 0
		message: str | None = None
		error: Exception | str | None = None
	@dataclass
	class QuitCallback:
		func: Callable[[], None]
		called: bool = False

	def __init__(self):
		self._result: _Lifecycle.Result = self.Result()
		self._result_lock: threading.Lock = threading.Lock()
		self._quit_event: threading.Event = threading.Event()
		self._quit_callbacks: dict[str, _Lifecycle.QuitCallback] = {}
		self._quit_callbacks_lock: threading.Lock = threading.Lock()

	def quit(self, *, exit_code: int | None = None, message: str | None = None, error: Exception | str | None = None):
		self._quit_event.set()
		log.warning('Quit request received', extra={
			'c': exit_code,
			'm': message,
			'e': error,
		})

		with self._result_lock:
			self._result.code = exit_code if exit_code is not None else self._result.code
			if self._result.code == 0 and error is not None:
				self._result.code = os.EX_DATAERR
				log.warning(f'Non-zero exit code inferred from error: {self._result.code}')
			self._result.message = message or self._result.message
			self._result.error = error or self._result.error
		self.run_quit_callbacks()

	def on_quit(self, func: Callable[[], None], key: str | None = None) -> str:
		with self._quit_callbacks_lock:
			if key is None:
				key = f'quit_callback_{secrets.token_hex(4)}'
			if key in self._quit_callbacks:
				log.warning(f'Quit callback with key "{key}" already exists and will be overwritten')
				del self._quit_callbacks[key]
			self._quit_callbacks[key] = self.QuitCallback(func=func)
			return key

	def remove_on_quit(self, key: str) -> bool:
		with self._quit_callbacks_lock:
			if key in self._quit_callbacks:
				del self._quit_callbacks[key]
				return True
			return False

	def run_quit_callbacks(self, timeout: float = 10.0):
		with self._quit_callbacks_lock:
			pending = [cb for cb in self._quit_callbacks.values() if not cb.called]
			for cb in pending:
				cb.called = True

		for callback in pending:
			def _run(cb=callback):
				try:
					cb.func()
				except Exception as e:
					log.exception(e)
			t = threading.Thread(target=_run, daemon=True, name='lifecycle_quit_callback')
			t.start()
			t.join(timeout=timeout)
			if t.is_alive():
				log.warning(f'Quit callback did not complete within {timeout}s, continuing shutdown')

	def wait(self, seconds: float | None = None) -> bool:
		return self._quit_event.wait(timeout=seconds)

	def running(self) -> bool:
		return not self._quit_event.is_set()

	def result(self) -> Result:
		with self._result_lock:
			return dataclasses.replace(self._result)

	def quit_if_fail(self, func: Callable[[], Any]):
		try:
			return func()
		except Exception as e:
			log.exception(e)
			self.quit(exit_code=os.EX_DATAERR, error=e)

	def handle_signal(self, sig: int, _: Any) -> None:
		log.info(f'Caught signal "{sig}"')
		self.quit()

	def register_handler(self, sig: int = signal.SIGINT):
		signal.signal(sig, self.handle_signal)

_lifecycle = _Lifecycle()
def running():
	return _lifecycle.running()
def wait(seconds: float | None = None):
	return _lifecycle.wait(seconds)
def quit(*, exit_code: int | None = None, message: str | None = None, error: Exception | str | None = None): # pylint: disable=redefined-builtin
	_lifecycle.quit(exit_code=exit_code, message=message, error=error)
def on_quit(func: Callable[[], None], key: str | None = None) -> str:
	return _lifecycle.on_quit(func, key)
def remove_on_quit(key: str) -> bool:
	return _lifecycle.remove_on_quit(key)
def result() -> _Lifecycle.Result:
	return _lifecycle.result()

from typing import Callable
import threading
import time

from . import logger
log = logger.get('threads')

class Threads:
	def __init__(self):
		self._meta: dict[str, dict] = {}
		self._started: dict[str, threading.Thread] = {}
		self._not_started: dict[str, threading.Thread] = {}

	def add(self, t: threading.Thread | Callable, *, name: str | None = None, start=True, meta: dict | None = None) -> threading.Thread:
		self.cleanup()
		if meta is None:
			meta = {}
		if isinstance(t, Callable):
			t = threading.Thread(target=t)
		if name is not None:
			t.name = name
		if t.name in self._started or t.name in self._not_started:
			raise ValueError(f'Thread with name <{t.name}> already exists')

		self._meta[t.name] = meta
		if start:
			if not t.is_alive():
				t.start()
			self._started[t.name] = t
		else:
			self._not_started[t.name] = t
		return t

	def get_meta(self, t: threading.Thread) -> dict:
		return self._meta.get(t.name, {})

	def remove(self, t: threading.Thread) -> None:
		if t.name in self._started:
			del self._started[t.name]
			if t.name in self._meta:
				del self._meta[t.name]

	def cleanup(self) -> None:
		dead = [t for t in self._started.values() if not t.is_alive()]
		for t in dead:
			self.remove(t)

	def start_all(self) -> None:
		for name, t in self._not_started.items():
			log.info(f'Starting thread <{name}>')
			t.start()
			self._started[name] = t
		self._not_started.clear()

	def clear(self) -> None:
		self._meta = {}
		self._started = {}
		self._not_started = {}

	def join(self) -> None:
		for i in range(3):
			if len(self._started) == 0:
				break

			log.info(f'Joining threads (attempt {i + 1}/3)')
			joined: list[str] = []

			for name, t in self._started.items():
				log.info(f'Cleanup <{name}.join>')
				if not t.is_alive():
					joined.append(name)
					continue

				try:
					t.join(0.01)
					if t.is_alive():
						log.warning(f'Thread <{name}> is still alive after join timeout')
					else:
						joined.append(name)
				except RuntimeError as e:
					log.error(f'Failed to join thread <{name}>: {e}')

			for name in joined:
				if name in self._started:
					del self._started[name]
			if len(self._started):
				time.sleep(1)

		self.clear()

_threads = Threads()
def thread(t: threading.Thread | Callable, *, name: str | None = None, start=True, meta: dict | None = None) -> threading.Thread:
	return _threads.add(t, name=name, start=start, meta=meta)

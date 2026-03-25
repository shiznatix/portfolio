from typing import Optional
import threading
import time

import numpy as np

class Stream:
	def __init__(self):
		self.frame: Optional[np.ndarray] = None
		self.condition = threading.Condition()

	def get_frame(self) -> Optional[np.ndarray]:
		with self.condition:
			return self.frame.copy() if self.frame is not None else None

	def set_frame(self, frame: np.ndarray):
		with self.condition:
			self.frame = frame.copy()
			self.condition.notify_all()

	def wait_for_new_frame(self, timeout: Optional[float] = None) -> Optional[np.ndarray]:
		with self.condition:
			current = self.frame
			notified = self.condition.wait_for(lambda: self.frame is not current, timeout=timeout)
			if notified:
				return self.frame.copy() if self.frame is not None else None

class Manager:
	streams: dict[str, Stream] = {}
	lock = threading.RLock()

	@staticmethod
	def has_stream(name: str):
		with Manager.lock:
			return name in Manager.streams

	@staticmethod
	def add_stream(name: str):
		with Manager.lock:
			if Manager.has_stream(name):
				raise ValueError(f'Stream with name {name} already exists')
			Manager.streams[name] = Stream()
			return Manager.streams[name]

	@staticmethod
	def get_stream(name: str, *, retries: int = 0):
		try:
			with Manager.lock:
				if not Manager.has_stream(name):
					raise ValueError(f'Stream with name {name} does not exist')
				return Manager.streams[name]
		except ValueError as e:
			if retries > 0:
				time.sleep(0.2)
				return Manager.get_stream(name, retries=retries - 1)
			raise e

	@staticmethod
	def remove_stream(stream: Stream):
		with Manager.lock:
			for name, s in Manager.streams.items():
				if s is stream:
					del Manager.streams[name]
					break

import abc
import logging
import threading
from typing import TypeVar, Generic, Optional, List

from pydantic import Field, SkipValidation, model_validator

import rhpy
from rhpy import matches_sensor_schema
from config import SourceConfig

S = TypeVar('S', bound=SourceConfig)

class SourceMatch(Generic[S]):
	def __init__(self, source: S, name: str, value):
		self.source: S = source
		self.name: str = name
		self.value = value

class Receiver(abc.ABC, Generic[S]):
	name: str
	type: str
	sources: List[S] = []
	log: SkipValidation[logging.Logger] = Field(default=None, exclude=True)  # type: ignore[assignment]
	match: SourceMatch[S] | None = None
	match_lock: SkipValidation[threading.RLock] = Field(default_factory=threading.RLock, exclude=True)

	@model_validator(mode='after')
	def set_log(self):
		self.log = rhpy.logs(f'{self.type}-{self.name}')
		return self

	def __str__(self):
		return f'{self.type}.{self.name}'

	@abc.abstractmethod
	def init_receiver(self):
		pass

	@abc.abstractmethod
	def receive(self, data: rhpy.SensorValue) -> bool:
		pass

	@abc.abstractmethod
	def run(self):
		pass

	@abc.abstractmethod
	def cleanup(self):
		pass

	def init_and_run(self):
		try:
			self.init_receiver()
			self.run()
		except Exception as e:
			self.log.exception(e)
			rhpy.quit()
			raise e
		finally:
			self.cleanup()

	def get_first_match(self, data) -> Optional[SourceMatch[S]]:
		for source in self.sources:
			matched, name, value = matches_sensor_schema(data, source.match_schema)
			if matched:
				return SourceMatch(source, str(name), value)
		return None

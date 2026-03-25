from typing import TypeVar
import abc
import logging
import random

from prometheus_client.metrics import MetricWrapperBase
from pydantic import model_validator

import rhpy
from config import SensorConfig

T = TypeVar('T', bound=MetricWrapperBase)

class Sensor(abc.ABC, SensorConfig):
	log: logging.Logger = rhpy.logs('sensor')

	@model_validator(mode='after')
	def set_log(self):
		self.log = rhpy.logs(self.name)
		if self.quiet:
			self.log.setLevel(logging.WARNING)
		return self

	@abc.abstractmethod
	def init_sensor(self): ...

	@abc.abstractmethod
	def run(self): ...

	def cleanup(self): ...

	def init_and_run(self):
		try:
			random_delay = round(random.uniform(0, 5), 2) # Random delay to avoid all sensors starting at the same time
			self.log.info(f'Waiting for {random_delay} seconds before starting sensor')
			rhpy.wait(random_delay)

			while rhpy.running():
				try:
					self.log.info('Initing sensor')
					self.init_sensor()
					self.log.info('Starting main loop')
					self.run()
				except Exception as e:
					self.log.error(f'Sensor init_and_run failed: {e}')
					self.cleanup()
					rhpy.wait(10)
		except Exception as e:
			self.log.exception(e)
			rhpy.quit(error=e)
		finally:
			self.cleanup()

	def send_value(self, value: int | float | dict):
		rhpy.publish(self.name, self.receiver_urls, body={'value': value})

	def metric(self, collector: T) -> T:
		return collector.labels(self.module, self.name, self.prometheus_title)

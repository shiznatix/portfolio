import re
from typing import Any
from xmlrpc.client import boolean

from pydantic import ConfigDict, model_validator
import rhpy

class SensorConfig(rhpy.Model):
	model_config = ConfigDict(extra='allow', arbitrary_types_allowed=True)

	name: str
	module: str
	prometheus_title: str
	receiver_urls: list[str] = []
	quiet: bool = False
	disabled: bool = False

class _Config(rhpy.Config):
	sensors: dict[str, SensorConfig]
	no_i2c: boolean = False
	no_one_wire: boolean = False

	@model_validator(mode='wrap')
	@classmethod
	def set_sensor_names(cls, value, handler):
		if isinstance(value, dict) and 'sensors' in value:
			for key, sensor_data in value['sensors'].items():
				if isinstance(sensor_data, dict):
					sensor_data['name'] = key
					sensor_data['prometheus_title'] = sensor_data.get('prometheus_title', key)
		return handler(value)

	def print_all_dump(self):
		vals = self.model_dump()
		sensors: dict[str, dict[str, Any]] = vals.get('sensors', {})

		for name, conf in sensors.items():
			del conf['name']

			if conf.get('prometheus_title') == name:
				del conf['prometheus_title']
			if conf.get('disabled') is False:
				del conf['disabled']
			if conf.get('quiet') is False:
				del conf['quiet']

			for i, url in enumerate(conf.get('receiver_urls', [])):
				conf['receiver_urls'][i] = re.sub(r'https?://', '', url)

			receiver_urls = conf.pop('receiver_urls', [])
			vals[f'*.{name}'] = {**conf, 'receiver_urls': receiver_urls}

		del vals['sensors']
		return vals

Config = _Config()

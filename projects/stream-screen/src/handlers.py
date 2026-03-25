from typing import Literal

from pydantic import model_validator

import rhpy
from rhpy.web import RouteDecorators

import event
from config import Config


log = rhpy.logs('handlers')
router = RouteDecorators()

class SensorSchema(rhpy.SensorValue):
	@model_validator(mode='before')
	@classmethod
	def _map_events(cls, data: dict) -> dict:
		if isinstance(data, dict):
			if isinstance(data.get('alarm'), dict):
				alarm = data['alarm']
				if 'device' in alarm and 'name' not in data:
					data = {**data, 'name': alarm['device']}
				if 'type' in alarm and 'value' not in data:
					data = {**data, 'value': alarm['type']}
		return data

def _handle_sensor_value(source: Literal['http', 'redis'], body: SensorSchema):
	with rhpy.perf(key=f'handle_{source}:{body.name}', threshold=None):
		matches = event.emit_external_input(body)
	# logging
	log_extra = body.value if isinstance(body.value, dict) else { 'value': body.value }
	log.info(f'Sensor {body.name} matches:{matches}', extra={**log_extra, 'post_str': body})
	return True


@router.post('/', body=SensorSchema)
async def handle_post(body: SensorSchema):
	return _handle_sensor_value('http', body)

def register_redis_handlers():
	def handle_sensor_message(body: SensorSchema):
		return _handle_sensor_value('redis', body)
	def handle_detections_message(body: rhpy.ImageDetections):
		event.publish(event.StreamDetectionsChange, name=body.name, detections=body.detections)

	for redis_event_conf in Config.redis_events:
		redis = rhpy.redis(redis_event_conf.url)
		redis.subscribe(redis_event_conf.channels, handle_sensor_message, model=SensorSchema)

	for stream in Config.streams:
		if stream.detections_source:
			redis = rhpy.redis(stream.detections_source.url)
			redis.subscribe(stream.detections_source.channels, handle_detections_message, model=rhpy.ImageDetections)

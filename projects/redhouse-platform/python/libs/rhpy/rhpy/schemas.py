from typing import Tuple, Any, Literal, Union
import json

from jsonschema import ValidationError, Draft7Validator

from . import model


class SensorValue(model.Model):
	name: str
	value: int | float | dict

class DetectionBox(model.Model):
	x: int
	y: int
	w: int
	h: int
	score: float
class ImageDetections(model.Model):
	name: str
	timestamp: int
	detections: list[DetectionBox]


_validator_cache: dict[int, Draft7Validator] = {}

def _get_validator(schema) -> Draft7Validator:
	key = id(schema)
	if key not in _validator_cache:
		_validator_cache[key] = Draft7Validator(schema)
	return _validator_cache[key]


def matches_sensor_schema(
	data: SensorValue,
	schema,
) -> Union[
	Tuple[Literal[True], str, Any],
	Tuple[Literal[False], None, None]
]:
	if schema is None:
		return (False, None, None)
	try:
		_get_validator(schema).validate(data.model_dump())
		return (True, data.name, data.value)
	except ValidationError:
		return (False, None, None)

def matches_image_detections_schema(
	data: ImageDetections,
	schema,
) -> Union[
	Tuple[Literal[True], str, Any],
	Tuple[Literal[False], None, None]
]:
	if schema is None:
		return (False, None, None)
	try:
		_get_validator(schema).validate(data.model_dump())
		return (True, data.name, data.detections)
	except ValidationError:
		return (False, None, None)

def matches_schema(
	data,
	schema,
) -> Union[
	Tuple[Literal[True], Any],
	Tuple[Literal[False], None]
]:
	if schema is None:
		return (False, None)
	try:
		data = json.loads(data) if isinstance(data, str) else data
		_get_validator(schema).validate(data)
		return (True, data)
	except ValidationError:
		return (False, None)
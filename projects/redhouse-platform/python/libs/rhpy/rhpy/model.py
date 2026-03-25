from typing import Any, Generic, Type, TypeVar

from pydantic import BaseModel, ConfigDict, Field, RootModel, model_validator

from .funcs import camel_to_snake

_PRESERVE_KEYS_MARKER = '_preserve_keys'
_SENTINEL = object()


def preserve_keys(default: Any = _SENTINEL, **kwargs: Any):
	"""Pydantic ``Field`` wrapper that prevents recursive camelCase key conversion.

	Use this when a field's value contains dict keys that should not be
	converted to snake_case (e.g. arbitrary user-supplied JSON).

	Example::

		class MyModel(Model):
			raw_data: dict = preserve_keys(default={})
	"""
	extra: dict[str, Any] = dict(kwargs.pop('json_schema_extra', None) or {})
	extra[_PRESERVE_KEYS_MARKER] = True
	if default is _SENTINEL:
		return Field(json_schema_extra=extra, **kwargs)
	return Field(default=default, json_schema_extra=extra, **kwargs)


class Model(BaseModel):
	model_config = ConfigDict(arbitrary_types_allowed=True)

	"""Base Pydantic model that automatically converts camelCase input keys to snake_case.

	Example::

		class AppModel(Model):
			my_field: str

		AppModel.model_validate({'myField': 'hello'})  # my_field = 'hello'
	"""
	@model_validator(mode='before')
	@classmethod
	def _convert_camel_to_snake(cls, data: Any) -> dict:
		if not isinstance(data, dict):
			return data

		# Fields where the value should be passed through unchanged.
		preserved: set[str] = {
			name
			for name, info in cls.model_fields.items()
			if isinstance(info.json_schema_extra, dict)
			and info.json_schema_extra.get(_PRESERVE_KEYS_MARKER)
		}

		if not preserved:
			return camel_to_snake(data)

		# Convert keys normally but skip recursive value conversion for
		# preserved fields.
		result: dict[str, Any] = {}
		for k, v in data.items():
			new_key = camel_to_snake(
				''.join(
					word.capitalize() if i > 0 else word
					for i, word in enumerate(k.split('_'))
				)
			)
			if new_key in preserved:
				result[new_key] = v
			else:
				result[new_key] = camel_to_snake(v) if isinstance(v, (dict, list)) else v
		return result

	def print_all_dump(self):
		return self.model_dump()

T = TypeVar('T')
class ModelField(RootModel[T], Generic[T]):
	"""Typed root model that unwraps to its inner value on ``model_validate``.

	Useful for validating a single primitive or typed value rather than a dict.

	Example::

		class MyList(ModelField[list[str]]): ...

		value = MyList.model_validate(['a', 'b'])  # returns list[str], not a RootModel
	"""
	@model_validator(mode='before')
	@classmethod
	def _convert_camel_to_snake(cls, data: T) -> T:
		if isinstance(data, dict):
			return camel_to_snake(data)
		return data

	@classmethod
	def model_validate(cls, obj: Any, **kwargs: Any) -> T:
		instance = super().model_validate(obj, **kwargs)
		return instance.root

AnyModel = Type[Model | ModelField[Any]]

import json
from pathlib import Path
from typing import ClassVar, Type

from pydantic import ConfigDict
from pydantic._internal._model_construction import ModelMetaclass

from .model import Model
from .funcs import pretty_str

_project_root = Path(__file__).resolve().parents[2]
# Module-level registry of all Config instances in creation order.
_registry: list['Config'] = []
# Raw JSON data keyed by Config subclass.
_raw_data: dict[type, dict] = {}


_DEFAULT_FILE_NAMES = ['config.json', 'config-server.json']


def _resolve_config_path(file_name: str, config_path: str | Path | None) -> Path:
	if config_path is not None:
		return Path(config_path)
	cwd = Path.cwd() / file_name
	if cwd.is_file():
		return cwd
	return _project_root / file_name


def _find_config_path(config_path: str | Path | None) -> Path:
	"""Try each default file name in cwd then project root; raise if none found."""
	if config_path is not None:
		return Path(config_path)
	for name in _DEFAULT_FILE_NAMES:
		cwd = Path.cwd() / name
		if cwd.is_file():
			return cwd
		root = _project_root / name
		if root.is_file():
			return root
	raise FileNotFoundError(
		f'No config file found. Tried: {_DEFAULT_FILE_NAMES} in {Path.cwd()} and {_project_root}'
	)


class PortsConfig(Model):
	"""Port bindings parsed from the ``ports`` key of a config JSON.

	Extra keys beyond ``http`` are allowed and accessible via ``model_extra``.
	"""
	model_config = ConfigDict(extra='allow')
	http: int


class ConfigMeta(ModelMetaclass):
	"""
	Metaclass that:
	- Intercepts bare ``_Config()`` calls to load the JSON file *before* Pydantic
	  validates, so required fields without defaults work correctly.
	- Delegates class-level attribute access to the registered instance so
	  ``AppConfig.my_field`` works without a separate module-level variable.
	"""
	def __call__(cls, **kwargs):
		# Bare instantiation on a concrete subclass: load from file first so
		# Pydantic receives real data before validating required fields.
		if not kwargs and cls is not Config:
			if cls.file_name is None:
				path = _find_config_path(cls.config_path)
			else:
				path = _resolve_config_path(cls.file_name, cls.config_path)
				if not path.is_file():
					raise FileNotFoundError(f'Config file not found: {path}')
			with path.open(encoding='utf8') as fh:
				data = json.load(fh)
			_raw_data[cls] = data
			instance = cls.model_validate(data)
			_registry.append(instance)
			return instance
		# Normal Pydantic construction (explicit kwargs, or called by model_validate).
		return super().__call__(**kwargs)

	def __getattr__(cls, name: str):
		for instance in _registry:
			if isinstance(instance, cls):
				# Only delegate to the instance for known model fields or you get recursion
				if name not in type(instance).model_fields:
					break
				try:
					return getattr(instance, name)
				except AttributeError:
					break
		raise AttributeError(
			f"'{cls.__name__}.{name}' — no registered instance found. "
			f"Ensure {cls.__name__}() has been instantiated before accessing fields."
		)


class Config(Model, metaclass=ConfigMeta):
	"""Base class for JSON-backed application config.

	Subclass it, declare your fields, then call ``MyConfig()`` once at startup.
	After that, fields are accessible directly on the class (``MyConfig.my_field``).

	Example::

		class AppConfig(Config):
			file_name = 'config.json'
			debug: bool = False
			db_url: str

		AppConfig()  # loads from file
		print(AppConfig.debug)
	"""
	file_name: ClassVar[str | None] = None
	config_path: ClassVar[str | Path | None] = None

	def print_config(self) -> None:
		module_vars = self.print_all_dump()
		pretty_vars: dict[str, str] = {k: pretty_str(v) for k, v in module_vars.items()}

		max_len = 45
		max_key_len = min(max((len(k) for k in pretty_vars.keys()), default=10), max_len)
		max_val_len = 0
		for v in pretty_vars.values():
			lines = v.split('\n')
			for line in lines:
				max_val_len = max(max_val_len, len(line))
		max_val_len = min(max_val_len, max_len)
		total_width = max_key_len + max_val_len + 5

		div_section = f'|{"=" * total_width}|'
		div_var = f'| {"-" * max_key_len}-+-{"-" * max_val_len} |'

		print(div_section)
		print(f'|{"** CONFIG **":^{total_width}}|')
		print(div_section)
		keys_list = list(pretty_vars.keys())
		for idx, key in enumerate(keys_list):
			lines = pretty_vars[key].split('\n')

			print(f'| {key:<{max_key_len}} | {lines[0]:<{max_val_len}} |')
			for line in lines[1:]:
				print(f'| {"" :<{max_key_len}} | {line:<{max_val_len}} |')

			if idx < len(keys_list) - 1:
				print(div_var)
		print(div_section)


def ports() -> PortsConfig:
	"""Return the ``PortsConfig`` from the first registered config that has a ``ports`` key.

	Raises ``RuntimeError`` if no config has been registered or none contains ``ports``.
	"""
	if not _registry:
		raise RuntimeError(
			'No Config instance found. Ensure a Config subclass is instantiated before calling ports().'
		)
	for instance in _registry:
		raw = _raw_data.get(type(instance), {})
		ports_raw = raw.get('ports')
		if ports_raw is not None:
			return PortsConfig.model_validate(ports_raw)
	raise RuntimeError(
		'No "ports" key found in any registered Config. '
		'Ensure your config JSON contains a "ports" object with at least an "http" field.'
	)


def print_all_configs() -> None:
	"""Pretty-print every registered Config instance to stdout."""
	for instance in _registry:
		instance.print_config()


def register(config: Config | Type[Config]) -> Config:
	"""Register a Config instance (or instantiate a class) into the global registry.

	Idempotent — registering the same instance twice has no effect.
	"""
	instance = config if isinstance(config, Config) else config()
	if instance not in _registry:
		_registry.append(instance)
	return instance

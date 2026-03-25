"""rhpy package."""

from importlib.metadata import PackageNotFoundError, version

# Import modules for namespace access
from .funcs import ( # pylint: disable=redefined-builtin
	snake_to_camel, camel_to_snake,
	pin,
	convert_size, file_size,
	days_elapsed, days_to_seconds, seconds_elapsed, second_of_day, relative_day,
	print_pretty,
	network_info, ip_is_local, url_is_local,
	uptime_sec,
	rounded as round,
)
from .logger import (
	Logger,
	DEBUG, INFO, ERROR, WARNING,
	get as logs, set_global_level as global_log_level, filter_logs
)
from . import colors_rgb as rgb

# Import key classes and types for direct access
from .config import Config, ports, print_all_configs, register
from .model import Model, ModelField, preserve_keys
from .schemas import SensorValue, ImageDetections, DetectionBox, matches_sensor_schema, matches_image_detections_schema, matches_schema
from .settings import Settings
from .threads import Threads, thread
from .timers import Timer, Timers, timer
from .lifecycle import running, wait, quit, on_quit, remove_on_quit, result # pylint: disable=redefined-builtin
from .performance import PerfLock, perf, perf_enabled, perf_start, perf_end
from .publisher import publish
from .redis_client import RedisClient, get_redis_client as redis
from .main import run

try:
	__version__ = version('rhpy')
except PackageNotFoundError:
	__version__ = '0.0.0'


__all__ = [
	'__version__',
	# Modules
	'funcs',
	'rgb',

	# main entry
	'run',
	# logger
	'DEBUG',
	'INFO',
	'ERROR',
	'WARNING',
	'logs',
	'global_log_level',
	'filter_logs',
	# thread
	'thread',
	# perf
	'perf',
	'perf_enabled',
	'perf_start',
	'perf_end',
	# remote url publisher
	'publish',
	# timers
	'timer',
	# lifecycle
	'running',
	'wait',
	'quit',
	'on_quit',
	'remove_on_quit',
	'result',
	# redis
	'redis',
	# funcs
	'preserve_keys',
	'matches_sensor_schema',
	'matches_schema',
	'snake_to_camel',
	'camel_to_snake',
	'pin',
	'convert_size',
	'file_size',
	'days_elapsed',
	'days_to_seconds',
	'seconds_elapsed',
	'second_of_day',
	'relative_day',
	'print_pretty',
	'network_info',
	'ip_is_local',
	'url_is_local',
	'uptime_sec',
	'round',
	# config
	'ports',
	'print_all_configs',
	'register',

	# Classes and types
	'Logger',
	'Config',
	'Threads',
	'PerfLock',
	'RedisClient',
	'Timers',
	'Timer',
	'Model',
	'ModelField',
	'Settings',
	'SensorValue',
	'ImageDetections',
	'DetectionBox',
]

from typing import ParamSpec, Protocol, runtime_checkable

import rhpy
from rhpy import matches_sensor_schema
from shared import ChangeDirection
from config import Config

from .events import Event
from .events import (
	RequestPauseChange, PauseChange,
	RequestMenuIndexChange, RequestMenuValueChange, ActiveMenuChange,
	ActiveStreamChange, AnyActiveChange,
	StreamBalanceChange, BusRtspError, RtspStatusChange,
	RequestNotificationValueChange, RequestNotificationRemove, AnyNotificationChange,
	StreamDetectionsChange,
	ServiceStarted,
)
from .payloads import payloads as pload, dicts as pdict
from .stats import stats

log = rhpy.logs('event')

_PSub = ParamSpec('_PSub')
_PPub = ParamSpec('_PPub')
@runtime_checkable
class _EventProtocol(Protocol[_PSub, _PPub]):
	def sub(self, *args: _PSub.args, **kwargs: _PSub.kwargs): ...
	def pub(self, *args: _PPub.args, **kwargs: _PPub.kwargs): ...

def subscribe(event: _EventProtocol[_PSub, _PPub], *args: _PSub.args, **kwargs: _PSub.kwargs):
	event.sub(*args, **kwargs)
def publish(event: _EventProtocol[_PSub, _PPub], *args: _PPub.args, **kwargs: _PPub.kwargs):
	event.pub(*args, **kwargs)

def emit_external_input(data: rhpy.SensorValue):
	matches = 0
	perf_threshold = 0.01

	# active state
	with rhpy.perf(key='emit_external_input:matches', threshold=perf_threshold):
		pause_stream = matches_sensor_schema(data, Config.pause_stream_schema)
		inc_menu = matches_sensor_schema(data, Config.increment_menu_schema)
		dec_menu = matches_sensor_schema(data, Config.decrement_menu_schema)
		inc_value = matches_sensor_schema(data, Config.increment_value_schema)
		dec_value = matches_sensor_schema(data, Config.decrement_value_schema)

	with rhpy.perf(key='emit_external_input:publish', threshold=perf_threshold):
		if pause_stream[0]:
			publish(RequestPauseChange)
			matches += 1
		if inc_menu[0]:
			publish(RequestMenuIndexChange, ChangeDirection.INC)
			matches += 1
		if dec_menu[0]:
			publish(RequestMenuIndexChange, ChangeDirection.DEC)
			matches += 1
		if inc_value[0]:
			publish(RequestMenuValueChange, ChangeDirection.INC)
			matches += 1
		if dec_value[0]:
			publish(RequestMenuValueChange, ChangeDirection.DEC)
			matches += 1

	# notifications
	with rhpy.perf(key='emit_external_input:notifications', threshold=perf_threshold):
		for notif in Config.notifications:
			notif_value = matches_sensor_schema(data, notif.value_schema)
			notif_remove = matches_sensor_schema(data, notif.remove_schema)

			if notif_value[0]:
				publish(RequestNotificationValueChange, name=notif.name, value=notif_value[2])
				matches += 1
			elif notif_remove[0]:
				publish(RequestNotificationRemove, notif.name)
				matches += 1

	return matches

__all__ = [
	'Event',
	'RequestPauseChange', 'PauseChange',
	'RequestMenuIndexChange', 'RequestMenuValueChange', 'ActiveMenuChange',
	'ActiveStreamChange', 'AnyActiveChange',
	'StreamBalanceChange', 'BusRtspError', 'RtspStatusChange',
	'RequestNotificationValueChange', 'RequestNotificationRemove', 'AnyNotificationChange',
	'StreamDetectionsChange',
	'ServiceStarted',
	'subscribe', 'publish',
	'emit_external_input',
]

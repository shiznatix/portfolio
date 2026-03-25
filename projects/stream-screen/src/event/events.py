from typing import Callable, TypeVar, Generic, Union, Optional, TypedDict, Any, Unpack
from abc import ABC, abstractmethod
import inspect

import rhpy
from shared import ChangeDirection
from .payloads import payloads as pload, dicts as pdict
from .subscribers import Subscriber
from .emitter import enqueue

log = rhpy.logs('event')

_TypePayload = TypeVar('_TypePayload')
_TypePayloadFilter = TypeVar('_TypePayloadFilter')

class Event(Generic[_TypePayload, _TypePayloadFilter], ABC):
	@property
	@abstractmethod
	def name(self) -> str:
		pass

	_debug = False

	def __init__(self):
		self._subscribers: dict[Any, Subscriber] = {}

	def _debug_log(self, message: str, *, extra: Optional[dict] = None):
		if self._debug:
			log.info(message, extra=extra)

	def pub(self, payload: _TypePayload, *, debug_key: Optional[str] = None):
		matched_subs = 0
		skipped_subs = 0
		matched_subscribers: list[Subscriber] = []
		pub_log_extra = {}
		if payload:
			pub_log_extra['payload'] = payload
		if debug_key:
			pub_log_extra['pub_debug_key'] = debug_key
		self._debug_log(f'Publishing {self.name}', extra=pub_log_extra)

		for subscriber in self._subscribers.values():
			sub_log_extra = { **pub_log_extra }
			if subscriber.filter:
				sub_log_extra['filter'] = subscriber.filter
			if subscriber.debug_key:
				sub_log_extra['sub_debug_key'] = subscriber.debug_key

			if subscriber.filter is not None:
				if isinstance(subscriber.filter, dict):
					match = True
					for key, value in subscriber.filter.items():
						if not hasattr(payload, key) or getattr(payload, key) != value:
							match = False
							break
				else:
					match = subscriber.filter == payload

				if not match:
					self._debug_log(f'Skip subscriber for {self.name}', extra=sub_log_extra)
					skipped_subs += 1
					continue

			matched_subscribers.append(subscriber)
			self._debug_log(f'Matched subscriber for {self.name}', extra=sub_log_extra)
			matched_subs += 1

		if matched_subs > 0:
			enqueue(self.name, payload, matched_subscribers, debug_key=debug_key)
			self._debug_log(f'Enqueued {self.name} matched:{matched_subs} skipped:{skipped_subs}', extra=pub_log_extra)
		else:
			self._debug_log(f'No matches for {self.name} skipped:{skipped_subs}')

	def sub(self, callback: Union[Callable[[_TypePayload], None], Callable[[], None]], p_filter: Optional[_TypePayloadFilter] = None, *, debug_key: Optional[str] = None):
		filter_key = tuple(sorted(p_filter.items())) if isinstance(p_filter, dict) else p_filter
		key = (callback, filter_key)
		if not self._subscribers.get(key):
			arg_count = len(inspect.signature(callback).parameters)
			self._subscribers[key] = Subscriber(callback, p_filter, arg_count, debug_key)

class _RequestPauseChange(Event):
	name: str = 'request.pause.change'
	def pub(self, *, debug_key: Optional[str] = None):
		super().pub(None, debug_key=debug_key)
	def sub(self, callback: Callable[[], None], *, debug_key: Optional[str] = None):
		super().sub(callback, None, debug_key=debug_key)
class _PauseChange(Event[bool, bool]):
	name: str = 'pause.change'

class _RequestMenuIndexChange(Event[ChangeDirection, ChangeDirection]):
	name: str = 'request.menu.index.change'
class _RequestMenuValueChange(Event[ChangeDirection, ChangeDirection]):
	name: str = 'request.menu.value.change'

class _ActiveMenuChange(Event[pload.ActiveMenu, pdict.ActiveMenu]):
	name: str = 'active.menu.change'
	def pub(self, *, debug_key: Optional[str] = None, **kwargs: Unpack[pdict.ActiveMenu]):
		super().pub(pload.ActiveMenu(**kwargs), debug_key=debug_key)

class _ActiveStreamChange(Event[pload.ActiveStream, pdict.ActiveStream]):
	name: str = 'active.stream.change'
	def pub(self, *, debug_key: Optional[str] = None, **kwargs: Unpack[pdict.ActiveStream]):
		super().pub(pload.ActiveStream(**kwargs), debug_key=debug_key)

class _AnyActiveChange(Event[pload.ActiveAll, None]):
	name: str = 'active.any.change'

class _FilterStream(TypedDict, total=False):
	name: str
class _StreamBalanceChange(Event[pload.StreamBalance, _FilterStream]):
	name: str = 'stream.balance.change'
	def pub(self, *, debug_key: Optional[str] = None, **kwargs: Unpack[pdict.StreamBalance]):
		super().pub(pload.StreamBalance(**kwargs), debug_key=debug_key)
	def sub(self, callback: Callable[[pload.StreamBalance], None], *, debug_key: Optional[str] = None, **kwargs: Unpack[_FilterStream]):
		super().sub(callback, _FilterStream(**kwargs), debug_key=debug_key)
class _BusRtspError(Event[pload.BusRtspError, _FilterStream]):
	name: str = 'bus.rtsp.error'
	def pub(self, *, debug_key: Optional[str] = None, **kwargs: Unpack[pdict.BusRtspError]):
		return super().pub(pload.BusRtspError(**kwargs), debug_key=debug_key)
	def sub(self, callback: Callable[[pload.BusRtspError], None], *, debug_key: Optional[str] = None, **kwargs: Unpack[_FilterStream]):
		super().sub(callback, _FilterStream(**kwargs), debug_key=debug_key)
class _RtspStatusChange(Event[pload.RtspStatusChange, _FilterStream]):
	name: str = 'rtsp.status.change'
	def pub(self, *, debug_key: Optional[str] = None, **kwargs: Unpack[pdict.RtspStatusChange]):
		return super().pub(pload.RtspStatusChange(**kwargs), debug_key=debug_key)
	def sub(self, callback: Callable[[pload.RtspStatusChange], None], *, debug_key: Optional[str] = None, **kwargs: Unpack[_FilterStream]):
		super().sub(callback, _FilterStream(**kwargs), debug_key=debug_key)
class _StreamDetectionsChange(Event[pload.StreamDetections, _FilterStream]):
	name: str = 'stream.detections.change'
	def pub(self, *, debug_key: Optional[str] = None, **kwargs: Unpack[pdict.StreamDetections]):
		super().pub(pload.StreamDetections(**kwargs), debug_key=debug_key)
	def sub(self, callback: Callable[[pload.StreamDetections], None], *, debug_key: Optional[str] = None, **kwargs: Unpack[_FilterStream]):
		super().sub(callback, _FilterStream(**kwargs), debug_key=debug_key)

class _FilterNotification(TypedDict, total=False):
	name: str
class _RequestNotificationValueChange(Event[pload.NotificationValue, _FilterNotification]):
	name: str = 'request.notification.value.change'
	# _debug = True
	def pub(self, *, debug_key: Optional[str] = None, **kwargs: Unpack[pdict.NotificationValue]):
		return super().pub(pload.NotificationValue(**kwargs), debug_key=debug_key)
	def sub(self, callback: Callable[[pload.NotificationValue], None], *, debug_key: Optional[str] = None, **kwargs: Unpack[_FilterNotification]):
		super().sub(callback, _FilterNotification(**kwargs), debug_key=debug_key)
class _RequestNotificationRemove(Event[str, str]):
	name: str = 'request.notification.remove'
class _AnyNotificationChange(Event):
	name: str = 'notification.any.change'
	def pub(self, *, debug_key: Optional[str] = None):
		super().pub(None, debug_key=debug_key)
	def sub(self, callback: Callable[[], None], *, debug_key: Optional[str] = None):
		super().sub(callback, None, debug_key=debug_key)

class _ServiceStarted(Event[pload.ServiceStarted, None]):
	name: str = 'service.started'

RequestPauseChange = _RequestPauseChange()
PauseChange = _PauseChange()
RequestMenuIndexChange = _RequestMenuIndexChange()
RequestMenuValueChange = _RequestMenuValueChange()
ActiveMenuChange = _ActiveMenuChange()
ActiveStreamChange = _ActiveStreamChange()
AnyActiveChange = _AnyActiveChange()
StreamBalanceChange = _StreamBalanceChange()
BusRtspError = _BusRtspError()
RtspStatusChange = _RtspStatusChange()
StreamDetectionsChange = _StreamDetectionsChange()
RequestNotificationValueChange = _RequestNotificationValueChange()
RequestNotificationRemove = _RequestNotificationRemove()
AnyNotificationChange = _AnyNotificationChange()
ServiceStarted = _ServiceStarted()

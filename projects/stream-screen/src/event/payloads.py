from __future__ import annotations
from typing import Union, Literal, TypedDict, Any, Optional
from dataclasses import dataclass

import rhpy
from shared import MenuName, LogfmtMixin, RtspStatus

@dataclass
class _Data(LogfmtMixin):
	pass

class ActiveMenu:
	class Dict(TypedDict):
		index: int
		name: MenuName
	@dataclass
	class Data(_Data):
		index: int
		name: MenuName

class ActiveStream:
	class Dict(TypedDict):
		index: int
		name: str
	@dataclass
	class Data(_Data):
		index: int
		name: str

class ActiveAll:
	class Dict(TypedDict):
		menu: ActiveMenu.Dict
		stream: ActiveStream.Dict
	@dataclass
	class Data(_Data):
		menu: Optional[ActiveMenu.Data]
		stream: ActiveStream.Data

class StreamBalance:
	class Dict(ActiveStream.Dict):
		prop: Union[Literal['brightness'], Literal['contrast']]
		value: float
	@dataclass
	class Data(ActiveStream.Data):
		prop: Union[Literal['brightness'], Literal['contrast']]
		value: float

class BusRtspError:
	class Dict(TypedDict):
		name: str
		error: str
	@dataclass
	class Data(_Data):
		name: str
		error: str

class RtspStatusChange:
	class Dict(TypedDict):
		name: str
		status: RtspStatus
		error: str | None
	@dataclass
	class Data(_Data):
		name: str
		status: RtspStatus
		error: str | None

class StreamDetections:
	class Dict(TypedDict):
		name: str
		detections: list[rhpy.DetectionBox]
	@dataclass
	class Data(_Data):
		name: str
		detections: list[rhpy.DetectionBox]

class NotificationValue:
	class Dict(TypedDict):
		name: str
		value: Any
	@dataclass
	class Data(_Data):
		name: str
		value: Any

class ServiceStarted:
	class Dict(TypedDict):
		paused: bool
	@dataclass
	class Data(_Data):
		paused: bool

class dicts:
	ActiveMenu = ActiveMenu.Dict
	ActiveStream = ActiveStream.Dict
	ActiveAll = ActiveAll.Dict
	StreamBalance = StreamBalance.Dict
	BusRtspError = BusRtspError.Dict
	RtspStatusChange = RtspStatusChange.Dict
	NotificationValue = NotificationValue.Dict
	StreamDetections = StreamDetections.Dict
	ServiceStarted = ServiceStarted.Dict

class payloads:
	ActiveMenu = ActiveMenu.Data
	ActiveStream = ActiveStream.Data
	ActiveAll = ActiveAll.Data
	StreamBalance = StreamBalance.Data
	BusRtspError = BusRtspError.Data
	RtspStatusChange = RtspStatusChange.Data
	StreamDetections = StreamDetections.Data
	NotificationValue = NotificationValue.Data
	ServiceStarted = ServiceStarted.Data

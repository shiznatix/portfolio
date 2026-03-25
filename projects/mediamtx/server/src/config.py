from typing import Any, Literal

from pydantic import Field, model_validator

import rhpy

###### Static configs
class BaseCameraConfig(rhpy.Model):
	out_width: int | str | None = None
	out_height: int | str | None = None
	out_framerate: int | str | None = None
	on_demand: bool = False
	record: bool = False
	record_path: str | None = None
	record_delete_after: str | None = None
	record_part_duration: str | None = None
	record_max_part_size: str | None = None
	record_segment_duration: str | None = None
	rh_hub_can_pan: bool = False
	rh_hub_can_tilt: bool = False
	rh_hub_can_shutter: bool = False
	rh_hub_rotate_degrees: int | None = None

class PiCameraConfig(BaseCameraConfig):
	type: Literal['picam'] = 'picam'
	secondary_stream: bool = False
	hflip: bool = False
	vflip: bool = False
	overlays: bool = False
	brightness: int | float = Field(default=0, ge=-1, le=1)
	contrast: int = Field(default=1, ge=0, le=16)
	saturation: int = Field(default=1, ge=0, le=16)
	sharpness: int = Field(default=1, ge=0, le=16)
	exposure: Literal['normal', 'short', 'long', 'custom'] = 'normal'
	auto_white_balance: Literal['auto', 'incandescent', 'tungsten', 'fluorescent', 'indoor', 'daylight', 'cloudy', 'custom'] = 'auto'
	shutter_speed: int = 0
	gain: int | float = 0
	metering: Literal['centre', 'spot', 'matrix', 'custom'] = 'centre'
	bitrate: int | None = None
	camera_codec: Literal['auto', 'hardwareH264', 'softwareH264', 'mjpeg'] | None = None
	raw_config_overrides: list[str] = []

##### Dynamic configs
class CameraModifiers(rhpy.Model):
	class DetectorHost(rhpy.Model):
		ip: str
		input: int
		output: int

	source_width: int | None = None
	source_height: int | None = None
	source_framerate: int | None = None
	color_format: Literal['rgb', 'bgr', 'yuv420p'] | None = None
	rotate: Literal[1, 2, 3] | None = None
	stream_quality: Literal['low', 'medium'] = 'low'
	start_timeout_sec: int | None = None
	close_after_sec: int | None = None
	overlays: bool = False
	detectors: list[Literal[
		'mediapipe.face', 'mediapipe.shoe', 'mediapipe.chair',
		'mediapipe.cup', 'mediapipe.camera',
		'blazeface',
		'yolo.face',
	]] = []
	detector_host: DetectorHost | None = None

class DynamicCameraConfig(BaseCameraConfig, CameraModifiers):
	type: Literal['dynamic'] = 'dynamic'
	url: str
	path: str
	path_prefix: str
	out_width: Literal['${G1}'] = '${G1}'
	out_height: Literal['${G2}'] = '${G2}'
	out_framerate: Literal['${G3}'] = '${G3}'
	on_demand: bool = True

	@model_validator(mode='before')
	@classmethod
	def _convert_camel_to_snake(cls, data: Any) -> dict:
		if not isinstance(data, dict) or 'path_prefix' not in data:
			return data
		data['path']  = f"~{data['path_prefix']}_([0-9]+)x([0-9]+)_([0-9]+)$"
		return data

##### Publisher configs
class _PublisherCameraConfig(BaseCameraConfig, CameraModifiers):
	runner: Literal['ffmpeg'] = 'ffmpeg'

class UsbCameraConfig(_PublisherCameraConfig):
	type: Literal['usb'] = 'usb'
	device: str
	format: Literal['mjpeg', 'yuyv422'] | None = None
class MjpegCameraConfig(_PublisherCameraConfig):
	type: Literal['mjpeg'] = 'mjpeg'
	url: str
class RtspCameraConfig(_PublisherCameraConfig):
	type: Literal['rtsp'] = 'rtsp'
	url: str

type CameraConfig = PiCameraConfig | UsbCameraConfig | MjpegCameraConfig | RtspCameraConfig | DynamicCameraConfig
type FfmpegCameraConfig = UsbCameraConfig | MjpegCameraConfig | RtspCameraConfig | DynamicCameraConfig

class PortsConfig(rhpy.Model):
	api: int | None = None
	metrics: int | None = None
	rtsp: int | None = None
	rtmp: int | None = None
	webrtc: int | None = None
	hls: int | None = None
	playback: int | None = None

class _Config(rhpy.Config):
	cameras: dict[str, CameraConfig]
	bind_ip: str = ''
	ports: PortsConfig
Config = _Config()

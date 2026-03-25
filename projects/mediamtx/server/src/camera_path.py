from __future__ import annotations
import os
import subprocess
from typing import TYPE_CHECKING

from config import Config
from ffmpeg_cmd import FfmpegCommand

if TYPE_CHECKING:
	from config import (
		PiCameraConfig,
		UsbCameraConfig,
		MjpegCameraConfig,
		RtspCameraConfig,
		DynamicCameraConfig,
		CameraConfig,
	)

def has_hw_encoder() -> bool:
	try:
		device_ok = os.path.exists('/dev/video11')  # /dev/video11 = V4L2 M2M encoder
		ffmpeg_ok = 'h264_v4l2m2m' in subprocess.check_output([
			'ffmpeg', '-hide_banner', '-encoders',
		], text=True)
		return device_ok and ffmpeg_ok
	except Exception:
		return False

class Path:
	def __init__(self, name: str, cam: CameraConfig):
		self.lines: list[str] = [
			'useAbsoluteTimestamp: yes',
		]
		self.on_demand: bool = cam.on_demand
		self.name: str = name
		self.path: str = name
		self.cam: CameraConfig = cam

	def source(self):
		if self.cam.record is True:
			record_path = self.cam.record_path
			record_delete_after = self.cam.record_delete_after
			record_part_duration = self.cam.record_part_duration
			record_max_part_size = self.cam.record_max_part_size
			record_segment_duration = self.cam.record_segment_duration

			self.lines.append('record: yes')
			if record_path:
				self.lines.append(f'recordPath: {record_path}')
			if record_delete_after:
				self.lines.append(f'recordDeleteAfter: {record_delete_after}')
			if record_part_duration:
				self.lines.append(f'recordPartDuration: {record_part_duration}')
			if record_max_part_size:
				self.lines.append(f'recordMaxPartSize: {record_max_part_size}')
			if record_segment_duration:
				self.lines.append(f'recordSegmentDuration: {record_segment_duration}')

		lines = [f'  {self.path}:']
		lines.extend(f'    {line}' for line in self.lines)
		return '\n'.join(lines)

class RpiCameraPath(Path):
	def __init__(self, name: str, cam: PiCameraConfig):
		super().__init__(name, cam)
		self.cam: PiCameraConfig = cam

	def source(self):
		secondary_stream = 'yes' if self.cam.secondary_stream else 'no'
		width = self.cam.out_width
		height = self.cam.out_height
		framerate = self.cam.out_framerate
		hflip = 'yes' if self.cam.hflip else 'no'
		vflip = 'yes' if self.cam.vflip else 'no'
		bitrate = self.cam.bitrate
		camera_codec = self.cam.camera_codec or 'auto'
		on_demand = 'yes' if self.on_demand else 'no'
		raw_config = self.cam.raw_config_overrides

		self.lines.append('source: rpiCamera')
		self.lines.append(f'sourceOnDemand: {on_demand}')
		self.lines.append(f'rpiCameraSecondary: {secondary_stream}')
		self.lines.append(f'rpiCameraWidth: {width}')
		self.lines.append(f'rpiCameraHeight: {height}')
		self.lines.append(f'rpiCameraFPS: {framerate}')
		self.lines.append(f'rpiCameraHFlip: {hflip}')
		self.lines.append(f'rpiCameraVFlip: {vflip}')
		self.lines.append(f'rpiCameraBrightness: {self.cam.brightness}')
		self.lines.append(f'rpiCameraContrast: {self.cam.contrast}')
		self.lines.append(f'rpiCameraSaturation: {self.cam.saturation}')
		self.lines.append(f'rpiCameraSharpness: {self.cam.sharpness}')
		self.lines.append(f'rpiCameraExposure: {self.cam.exposure}')
		self.lines.append(f'rpiCameraAWB: {self.cam.auto_white_balance}')
		self.lines.append(f'rpiCameraShutter: {self.cam.shutter_speed}')
		self.lines.append(f'rpiCameraGain: {self.cam.gain}')
		self.lines.append(f'rpiCameraMetering: {self.cam.metering}')
		self.lines.append(f'rpiCameraCodec: {camera_codec}')
		if bitrate:
			self.lines.append(f'rpiCameraBitrate: {bitrate}')
		if self.cam.overlays is True:
			self.lines.append('rpiCameraTextOverlayEnable: yes')
			self.lines.append('rpiCameraTextOverlay: "%a, %b %d %H:%M:%S"')
		if raw_config:
			self.lines.extend(raw_config)

		return super().source()

class UrlPath(Path):
	def __init__(self, name: str, cam: MjpegCameraConfig | RtspCameraConfig | DynamicCameraConfig):
		super().__init__(name, cam)
		self.cam: MjpegCameraConfig | RtspCameraConfig | DynamicCameraConfig = cam

	def source(self):
		on_demand = 'yes' if self.on_demand else 'no'
		self.lines.append(f'source: {self.cam.url}')
		self.lines.append(f'sourceOnDemand: {on_demand}')
		return super().source()


class PublisherPath(Path):
	def __init__(self, name: str, cam: UsbCameraConfig | MjpegCameraConfig | RtspCameraConfig | DynamicCameraConfig):
		super().__init__(name, cam)
		self.cam: UsbCameraConfig | MjpegCameraConfig | RtspCameraConfig | DynamicCameraConfig = cam
		self.base_dir = os.getcwd()
		self.command_file = f'path_{self.name}.sh'
		self.command_path = os.path.join(self.base_dir, self.command_file)
		self.start_timeout_sec: int | None = cam.start_timeout_sec or 20

	def source(self):
		flags: list[str] = []
		command_str = self.ffmpeg()
		if self.start_timeout_sec:
			flags.append(f'--timeout={self.start_timeout_sec}')
		run_command = f'bash {self.base_dir}/ffmpeg.sh'

		with open(self.command_path, 'w', encoding='utf-8') as f:
			f.write(command_str)
		os.chmod(self.command_path, 0o755)

		flags_str = ' '.join(flags)
		run_on = 'runOnDemand' if self.on_demand else 'runOnInit'
		self.lines.append('source: publisher')
		if self.start_timeout_sec and self.on_demand:
			self.lines.append(f'{run_on}StartTimeout: {self.start_timeout_sec}s')
		self.lines.append(f'{run_on}: {run_command} {self.command_file} {flags_str}')
		self.lines.append(f'{run_on}Restart: yes')
		self.lines.append(f'runOnReady: {self.base_dir}/publisher_state_change.sh ready')
		self.lines.append(f'runOnNotReady: {self.base_dir}/publisher_state_change.sh not-ready')
		return super().source()

	def ffmpeg(self) -> str:
		return FfmpegCommand(self.cam).build(self.base_dir, self.name)


class UsbPath(PublisherPath):
	def __init__(self, name: str, cam: UsbCameraConfig):
		super().__init__(name, cam)
		self.cam: UsbCameraConfig = cam


class MjpegPath(PublisherPath):
	def __init__(self, name: str, cam: MjpegCameraConfig):
		super().__init__(name, cam)
		self.cam: MjpegCameraConfig = cam


class RtspPath(PublisherPath):
	def __init__(self, name: str, cam: RtspCameraConfig | DynamicCameraConfig):
		super().__init__(name, cam)
		self.cam: RtspCameraConfig | DynamicCameraConfig = cam


class DynamicPath(RtspPath):
	def __init__(self, name: str, cam: DynamicCameraConfig):
		super().__init__(name, cam)
		self.cam: DynamicCameraConfig = cam
		self.path = f'~{cam.path_prefix}_([0-9]+)x([0-9]+)_([0-9]+)$'
		self.on_demand = True
		self.start_timeout_sec = cam.start_timeout_sec or 20

def builder(name: str):
	"""Build a path configuration for the given camera name using Config.cameras."""
	cam = Config.cameras[name]

	if cam.type == 'picam':
		return RpiCameraPath(name, cam)
	elif cam.type == 'usb':
		return UsbPath(name, cam)
	elif cam.type == 'mjpeg':
		return MjpegPath(name, cam)
	elif cam.type == 'rtsp':
		has_ffmpeg_modifiers = (
			cam.out_width
			or cam.out_height
			or cam.out_framerate
			or cam.rotate
			or cam.detectors
		)
		if has_ffmpeg_modifiers:
			return RtspPath(name, cam)
		else:
			return UrlPath(name, cam)
	elif cam.type == 'dynamic':
		return DynamicPath(name, cam)

	return None

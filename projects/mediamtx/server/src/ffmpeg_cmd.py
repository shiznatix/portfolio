from __future__ import annotations

from config import CameraModifiers, FfmpegCameraConfig


class GlobalFlagsSection:
	def to_args(self) -> list[str]:
		return [
			'-fflags +discardcorrupt+nobuffer -flags low_delay',
			'-err_detect ignore_err -loglevel error -report',
		]


class InputSection:
	def __init__(self, cam: FfmpegCameraConfig):
		if cam.type == 'usb':
			self.transport = f'-f v4l2 -input_format {cam.format or "mjpeg"}'
		elif cam.type == 'mjpeg':
			self.transport = '-use_wallclock_as_timestamps 1 -re -stream_loop -1'
		else:  # rtsp, dynamic
			self.transport = '-rtsp_transport udp'

		self.framerate = cam.source_framerate
		self.width = cam.source_width
		self.height = cam.source_height
		self.source = getattr(cam, 'device', None) or getattr(cam, 'url', '')
		self._mjpeg = cam.type == 'mjpeg'

	def to_args(self) -> list[str]:
		args = [self.transport]
		if self.framerate is not None:
			args.append(f'-framerate {self.framerate}')
		if self.width is not None and self.height is not None:
			args.append(f'-video_size {self.width}x{self.height}')
		if self._mjpeg:
			args.append('-f mjpeg')
		args.append(f'-i {self.source}')
		return args


class FilterSection:
	class OverlaySection:
		def __init__(self, cam: FfmpegCameraConfig):
			self.enabled = cam.overlays

		def to_args(self) -> list[str]:
			args = []
			if self.enabled:
				parts = [
					'fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
					"text='%{localtime\\\\:%X}'",
					'x=(w-text_w)/2',
					'y=h-th-10',
					'fontcolor=white',
					'fontsize=30',
					'box=1',
					'boxcolor=black@0.75',
					'boxborderw=5',
				]
				args.append(f'drawtext="{":".join(parts)}"')
			return args

	def __init__(self, cam: FfmpegCameraConfig):
		self.scale = (cam.out_width, cam.out_height) if (cam.out_width and cam.out_height) else None
		self.fps = cam.out_framerate
		self.rotate = cam.rotate
		self.color_format = cam.color_format
		self.overlay = self.OverlaySection(cam)

	def _exprs(self, force_format: str | None = None) -> list[str]:
		filters: list[str] = []
		if self.scale:
			filters.append(f'scale={self.scale[0]}:{self.scale[1]}')
		if self.fps:
			filters.append(f'fps={self.fps}')
		if self.rotate:
			filters.extend(['transpose=2'] * self.rotate)
		fmt = force_format or {'rgb': 'rgb24', 'bgr': 'bgr24', 'yuv420p': 'yuv420p'}.get(self.color_format or '')
		if fmt:
			filters.append(f'format={fmt}')
		return filters

	def to_args(self) -> list[str]:
		filters = self._exprs()
		filters.extend(self.overlay.to_args())
		return [f'-vf {",".join(filters)}'] if filters else []

	def to_pre_detection_args(self) -> list[str]:
		filters = self._exprs(force_format='rgb24')
		return [f'-vf {",".join(filters)}'] if filters else []

	def to_post_detection_args(self) -> list[str]:
		filters = self.overlay.to_args()
		return [f'-vf {",".join(filters)}'] if filters else []


class EncoderSection:
	def __init__(self, cam: FfmpegCameraConfig):
		self.codec = 'h264_v4l2m2m' if cam.type == 'usb' else 'libx264'
		self.quality = cam.stream_quality
		self.framerate = cam.out_framerate or 10

	def to_args(self) -> list[str]:
		flags: list[str] = []
		if self.codec == 'h264_v4l2m2m':
			flags.append('-c:v h264_v4l2m2m')
		if self.quality == 'low':
			if self.codec == 'libx264':
				flags.append('-c:v libx264 -preset ultrafast -tune zerolatency')
				flags.append('-profile:v baseline -level 3.0 -pix_fmt yuv420p')
			flags.append('-b:v 500k -maxrate 500k -bufsize 1000k')
		else:
			if self.codec == 'libx264':
				flags.append('-c:v libx264 -preset veryfast -tune zerolatency')
				flags.append('-profile:v baseline -level 3.1 -pix_fmt yuv420p')
			flags.append('-b:v 1000k -maxrate 1200k -bufsize 2000k')
		if self.codec == 'libx264':
			flags.append(f'-g {self.framerate} -keyint_min {self.framerate} -force_key_frames "expr:gte(t,n_forced*0.2)"')
			flags.append('-x264-params scenecut=0:open_gop=0:repeat-headers=1')
		return flags


class OutputSection:
	def to_args(self) -> list[str]:
		return [
			'-an -f rtsp rtsp://localhost:$RTSP_PORT/$MTX_PATH',
			'-progress $PROGRESS_PIPE -nostats',
		]


class DetectionSection:
	def __init__(self, cam: FfmpegCameraConfig):
		assert cam.detector_host is not None
		width = cam.out_width
		height = cam.out_height
		if cam.rotate and cam.rotate % 2 == 1:
			self.final_width = height
			self.final_height = width
		else:
			self.final_width = width
			self.final_height = height
		self.host: CameraModifiers.DetectorHost = cam.detector_host
		self.detectors = cam.detectors


# ---------------------------------------------------------------------------
# FfmpegCommand
# ---------------------------------------------------------------------------

class FfmpegCommand:
	def __init__(self, cam: FfmpegCameraConfig):
		self.global_flags = GlobalFlagsSection()
		self.input = InputSection(cam)
		self.filters = FilterSection(cam)
		self.encoder = EncoderSection(cam)
		self.output = OutputSection()
		self.detection = DetectionSection(cam) if (cam.detectors and cam.detector_host) else None

	def build(self, base_dir: str, name: str) -> str:
		if self.detection:
			return self._build_pipeline(base_dir, name)
		parts = (
			['ffmpeg']
			+ self.input.to_args()
			+ self.global_flags.to_args()
			+ self.filters.to_args()
			+ self.encoder.to_args()
			+ self.output.to_args()
		)
		return ' \\\n'.join(parts) + '\n'

	def _build_pipeline(self, base_dir: str, name: str) -> str:
		assert self.detection is not None
		d = self.detection

		# Part 1: decode → filters (with RGB24) → stdout
		pre_filter_args = self.filters.to_pre_detection_args()
		pre_parts = (
			['ffmpeg']
			+ self.input.to_args()
			+ self.global_flags.to_args()
			+ pre_filter_args
			+ ['-f rawvideo -pix_fmt rgb24', '-']
		)

		# Part 2: detection script
		detect_script = f'{base_dir}/.venv/bin/python {base_dir}/rh_image_detector.py'
		detect_cmd = ' '.join([
			detect_script,
			f'--name {name}',
			f'--width {d.final_width}',
			f'--height {d.final_height}',
			f'--host {d.host.ip}',
			f'--in-port {d.host.input}',
			f'--out-port {d.host.output}',
			'--parent-pid $PARENT_PID',
			f'--detectors {",".join(d.detectors)}',
		])

		# Part 3: post-detection encode
		post_filter_args = self.filters.to_post_detection_args()
		post_parts = (
			['ffmpeg', f'-f rawvideo -pix_fmt rgb24 -s {d.final_width}x{d.final_height}', '-i -']
			+ post_filter_args
			+ self.encoder.to_args()
			+ self.output.to_args()
		)

		all_parts = pre_parts + ['|', detect_cmd, '|'] + post_parts
		return ' \\\n'.join(all_parts) + '\n'

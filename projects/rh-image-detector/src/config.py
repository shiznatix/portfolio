from typing import Literal

import rhpy


class MediaPipeFaceConfig(rhpy.Model):
	name: Literal['mediapipe.face'] = 'mediapipe.face'
	model_selection: Literal['short-range', 'full-range'] = 'full-range'
	detection_threshold: float = 0.5
class MediaPipeObjectronConfig(rhpy.Model):
	name: Literal['mediapipe.shoe', 'mediapipe.chair', 'mediapipe.cup', 'mediapipe.camera']
	max_num_objects: int = 2
	detection_threshold: float = 0.5
	tracking_threshold: float = 0.5
class BlazeFaceConfig(rhpy.Model):
	name: Literal['blazeface'] = 'blazeface'
	model_path: str
	width: int
	height: int
	threshold: float = 0.5
class YOLOFaceConfig(rhpy.Model):
	name: Literal['yolo.face'] = 'yolo.face'
	model_path: str
	threshold: float = 0.5
ModelConfig = MediaPipeFaceConfig | MediaPipeObjectronConfig | BlazeFaceConfig | YOLOFaceConfig
ModelName = Literal[
	'mediapipe.face', 'mediapipe.shoe', 'mediapipe.chair', 'mediapipe.cup', 'mediapipe.camera',
	'blazeface',
	'yolo.face',
]

class NotifierConfig(rhpy.Model):
	debounce_sec: float = 5.0
	receiver_urls: list[str] = []

class ReadStreamsConfig(rhpy.Model):
	url: str
	detector_names: list[ModelName]

class _Config(rhpy.Config):
	input_port: int = 5420
	output_port: int = 5421
	prometheus_port: int = 5422
	notifiers: dict[str, list[NotifierConfig]] = {}
	models: list[ModelConfig] = []
	read_streams: dict[str, ReadStreamsConfig] = {}
Config = _Config()

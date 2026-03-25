from typing import Literal

import rhpy


class _Config(rhpy.Config):
	no_detection_mode: Literal['random', 'impossible', 'off'] = 'impossible'
Config = _Config()

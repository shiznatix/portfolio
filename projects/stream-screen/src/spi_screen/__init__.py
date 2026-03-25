import rhpy
from config import Config

from .st7789 import init as _st7789_init


log = rhpy.logs('spi.scrn')
_device = None

if Config.screen_type == 'st7789':
	log.info('Screen type is st7789')
	_device = _st7789_init()
else:
	log.info('SPI display not configured')

device = _device

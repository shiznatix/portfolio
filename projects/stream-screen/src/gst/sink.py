from PIL import Image

import rhpy
from gst.lib import Gst
import spi_screen
from config import Config

log = rhpy.logs('sink')

def kms():
	sink = Gst.ElementFactory.make('kmssink', 'sink')
	if not sink:
		raise RuntimeError('Failed to create kmssink element')
	if Config.display_driver:
		sink.set_property('driver-name', Config.display_driver)
	log.info('Using KMS sink')
	sink.set_property('sync', False)
	return sink

def framebuffer():
	sink = Gst.ElementFactory.make('fbdevsink', 'sink')
	if not sink:
		raise RuntimeError('Failed to create fbdevsink element')
	if Config.display_device:
		sink.set_property('device', Config.display_device)
	sink.set_property('sync', False)

	log.info(f'Using framebuffer device: {Config.display_device}')
	return sink

def spi_tft():
	sink = Gst.ElementFactory.make('appsink', 'sink')
	if not sink:
		raise RuntimeError('Failed to create appsink element')

	sink.set_property('emit-signals', True)
	sink.set_property('sync', False)
	sink.set_property('max-buffers', 1)
	sink.set_property('drop', True)
	sink.set_property('caps', Gst.Caps.from_string('video/x-raw,format=BGR'))

	caps: dict = {}

	def on_new_sample(sink):
		sample = sink.emit('pull-sample')
		buf = sample.get_buffer()
		if not caps:
			caps_structure = sample.get_caps().get_structure(0)
			caps['width'] = caps_structure.get_value('width')
			caps['height'] = caps_structure.get_value('height')
			caps['format'] = caps_structure.get_value('format')

		success, mapinfo = buf.map(Gst.MapFlags.READ)
		if success:
			try:
				image = Image.frombuffer('RGB', (caps['width'], caps['height']), mapinfo.data, 'raw', 'RGB', 0, 1)
				if spi_screen.device:
					spi_screen.device.display(image)
			except Exception as e:
				log.exception(e)
				log.error(f'Error processing frame: {e}')
				rhpy.wait(10)
			finally:
				buf.unmap(mapinfo)
		return Gst.FlowReturn.OK

	sink.connect('new-sample', on_new_sample)
	sink.set_property('sync', False)

	log.info('Using SPI TFT sink')
	return sink

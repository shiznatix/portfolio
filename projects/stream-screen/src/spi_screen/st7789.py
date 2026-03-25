import time

import rhpy
from config import Config

log = rhpy.logs('spi.st7789')

def init():
	from PIL import Image
	import spidev
	import gpiozero
	import numpy as np

	class ST7789:
		def __init__(self, *, spi: spidev.SpiDev, width: int, height: int, gpio_rst: int, gpio_dc: int, gpio_bl: int, bl_on_percent: int = 100, spi_freq = 40000000, bl_freq = 1000):
			self.width = width
			self.height = height

			self.gpio_rst = gpiozero.DigitalOutputDevice(gpio_rst, active_high=True, initial_value=False)
			self.gpio_dc = gpiozero.DigitalOutputDevice(gpio_dc, active_high=True, initial_value=False)
			self.gpio_bl = gpiozero.PWMOutputDevice(gpio_bl, frequency=bl_freq)
			self.gpio_bl.value = bl_on_percent / 100 # 0.0-1.0

			self.spi_freq = spi_freq
			self.spi = spi
			self.spi.max_speed_hz = self.spi_freq
			self.spi.mode = 0b00

			self.init()
			self.clear()

		def command(self, cmd):
			self.gpio_dc.off()
			self.spi.writebytes([cmd])

		def data(self, val):
			self.gpio_dc.on()
			self.spi.writebytes([val])

		def reset(self):
			self.gpio_rst.on()
			time.sleep(0.01)
			self.gpio_rst.off()
			time.sleep(0.01)
			self.gpio_rst.on()
			time.sleep(0.01)

		def init(self):
			self.spi.max_speed_hz = self.spi_freq
			self.spi.mode = 0b00

			self.reset()

			self.command(0x36)
			self.data(0x70) # self.data(0x00)

			self.command(0x11)

			time.sleep(0.12)

			self.command(0x36)
			self.data(0x00)

			self.command(0x3A)
			self.data(0x05)

			self.command(0xB2)
			self.data(0x0C)
			self.data(0x0C)
			self.data(0x00)
			self.data(0x33)
			self.data(0x33)

			self.command(0xB7)
			self.data(0x00)

			self.command(0xBB)
			self.data(0x3F)

			self.command(0xC0)
			self.data(0x2C)

			self.command(0xC2)
			self.data(0x01)

			self.command(0xC3)
			self.data(0x0D)

			self.command(0xC6)
			self.data(0x0F)

			self.command(0xD0)
			self.data(0xA7)

			self.command(0xD0)
			self.data(0xA4)
			self.data(0xA1)

			self.command(0xD6)
			self.data(0xA1)

			self.command(0xE0)
			self.data(0xF0)
			self.data(0x00)
			self.data(0x02)
			self.data(0x01)
			self.data(0x00)
			self.data(0x00)
			self.data(0x27)
			self.data(0x43)
			self.data(0x3F)
			self.data(0x33)
			self.data(0x0E)
			self.data(0x0E)
			self.data(0x26)
			self.data(0x2E)

			self.command(0xE1)
			self.data(0xF0)
			self.data(0x07)
			self.data(0x0D)
			self.data(0x0D)
			self.data(0x0B)
			self.data(0x16)
			self.data(0x26)
			self.data(0x43)
			self.data(0x3E)
			self.data(0x3F)
			self.data(0x19)
			self.data(0x19)
			self.data(0x31)
			self.data(0x3A)

			self.command(0x21)
			self.command(0x29)

		def set_windows(self, x_start, y_start, x_end, y_end):
			#set the X coordinates
			self.command(0x2A)
			self.data(0x00)               #Set the horizontal starting point to the high octet
			self.data(x_start & 0xff)      #Set the horizontal starting point to the low octet
			self.data(0x00)               #Set the horizontal end to the high octet
			self.data((x_end - 1) & 0xff) #Set the horizontal end to the low octet

			#set the Y coordinates
			self.command(0x2B)
			self.data(0x00)
			self.data((y_start & 0xff))
			self.data(0x00)
			self.data((y_end - 1) & 0xff )

			self.command(0x2C)

		def display(self, image: Image.Image):
			imwidth, imheight = image.size
			if imwidth != self.width or imheight != self.height:
				raise ValueError(f'Image must be same dimensions as display ({self.width}x{self.height})')
			if Config.screen_rotate:
				image = image.rotate(Config.screen_rotate)
			img = np.asarray(image)
			pix = np.zeros((self.width,self.height, 2), dtype = np.uint8)
			pix[..., [0]] = np.add(np.bitwise_and(img[..., [0]], 0xF8), np.right_shift(img[..., [1]], 5))
			pix[..., [1]] = np.add(np.bitwise_and(np.left_shift(img[..., [1]], 3), 0xE0), np.right_shift(img[..., [2]], 3))
			pix = pix.flatten().tolist()
			self.set_windows(0, 0, self.width, self.height)
			self.gpio_dc.on()
			for i in range(0, len(pix), 4096):
				self.spi.writebytes(pix[i:i+4096])

		def clear(self):
			_buffer = [0xff]*(self.width * self.height * 2)
			self.set_windows(0, 0, self.width, self.height)
			self.gpio_dc.on()
			for i in range(0, len(_buffer), 4096):
				self.spi.writebytes(_buffer[i:i+4096])

	log.info(f'Initializing screen ({Config.screen_width}x{Config.screen_height})')
	spi = spidev.SpiDev(0, 0)
	device = ST7789(
		spi=spi,
		width=Config.screen_width,
		height=Config.screen_height,
		gpio_rst=27,
		gpio_dc=25,
		gpio_bl=24,
	)
	log.info('Screen initialized')
	return device

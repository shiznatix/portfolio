from PIL import Image, ImageDraw, ImageFont
import numpy as np

import spi_screen
from config import Config

def show(*, text: str, bg_color: tuple[int, int, int], text_color: tuple[int, int, int]):
	dimens = (Config.screen_width, Config.screen_height) if Config.splash_rotate in (0, 180) else (Config.screen_height, Config.screen_width)
	image = Image.new('RGB', dimens, color=bg_color)
	font = ImageFont.load_default(40 * Config.font_size_scale)

	text_layer = Image.new('RGBA', dimens, (0, 0, 0, 0))
	text_draw = ImageDraw.Draw(text_layer)
	text_bbox = text_draw.textbbox((0, 0), text, font=font)
	text_w = text_bbox[2] - text_bbox[0]
	text_h = text_bbox[3] - text_bbox[1]
	text_x = (dimens[0] - text_w) // 2
	text_y = (dimens[1] - text_h) // 2
	text_draw.text((text_x, text_y), text, fill=text_color, font=font)
	if Config.splash_rotate:
		text_layer = text_layer.rotate(Config.splash_rotate, expand=False)
	image.paste(text_layer, mask=text_layer.split()[3])

	if spi_screen.device:
		spi_screen.device.display(image)
	elif Config.screen_type == 'framebuffer' and Config.display_device:
		rgba = np.array(image.convert('RGBA'), dtype=np.uint8)
		# framebuffer expects BGRA
		data = rgba[:, :, [2, 1, 0, 3]].tobytes()

		with open(Config.display_device, 'r+b') as f:
			f.seek(0)
			f.write(data)

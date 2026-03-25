from __future__ import annotations
import pathlib
import threading
import time

from PIL import Image, ImageDraw, ImageFont

from config import OledConfig

class FontConfig:
	PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
	MIN_SIZE = 1
	MAX_SIZE = 50

class AnimateConfig:
	TYPE_SWIM_LEFT_RIGHT = 'swim-left-right'

	def __init__(self, conf: OledConfig.Screen.Box.Animate):
		self.type: str = conf.type
		self.pixel_jump_x: int = conf.pixel_jump_x
		self.pixel_jump_y: int = conf.pixel_jump_y
		self.travel_direction_y: int = 1
		self.travel_direction_x: int = 1

class ElementConfig:
	def __init__(self, conf: OledConfig.Screen.Box):
		self.bb_x: int = conf.x
		self.bb_y: int = conf.y
		self.bb_width: int = conf.width
		self.bb_height: int = conf.height
		self.x: int = self.bb_x
		self.y: int = self.bb_y
		self.width: int = self.bb_width
		self.height: int = self.bb_height
		self.h_align: str | None = conf.halign
		self.v_align: str | None = conf.valign
		self.v_flip: bool = conf.vflip
		self.h_flip: bool = conf.hflip
		self.animate: AnimateConfig | None = AnimateConfig(conf.animate) if conf.animate else None

		text_config = conf.text
		image_config = conf.image

		self.match_schema = text_config.match_schema if text_config else None
		self.source_last_receive_time: float = 0
		self.type: str = 'image' if image_config else 'text'
		self.config: OledConfig.Screen.Box.Text | OledConfig.Screen.Box.Image | None = text_config if self.type == 'text' else image_config

class Element(ElementConfig):
	def __init__(self, conf: OledConfig.Screen.Box):
		super().__init__(conf)
		self.value_lock = threading.RLock()

	def set_xy(self):
		if self.h_align == 'center':
			x = self.bb_x + self.bb_width // 2 - self.width // 2
		elif self.h_align == 'right':
			x = self.bb_x + self.bb_width - self.width
		else: # left
			x = self.bb_x

		if self.v_align == 'center':
			y = self.bb_y + self.bb_height // 2 - self.height // 2
		elif self.v_align == 'bottom':
			y = self.bb_y + max(0, self.bb_height - self.height)
		else: # top
			y = self.bb_y

		self.x = x
		self.y = y

	def draw(self, draw: ImageDraw.ImageDraw, color: str):
		pass

	def set_value(self, value):
		pass

class TextElement(Element):
	FONTS = [ImageFont.truetype(FontConfig.PATH, size) for size in range(FontConfig.MIN_SIZE, FontConfig.MAX_SIZE + 1)][::-1]
	textbox: tuple[float, float, float, float] # (left, top, right, bottom)

	def __init__(self, conf: OledConfig.Screen.Box):
		super().__init__(conf)

		text_conf: OledConfig.Screen.Box.Text = self.config # type: ignore
		self.template: str | None = text_conf.template
		self.text: str = text_conf.text
		self.value_round_decimal: int | None = text_conf.value_round_decimal
		font_size: int = text_conf.font_size
		self.stroke_width: int = text_conf.stroke_width
		self.font: ImageFont.FreeTypeFont = TextElement.FONTS[len(TextElement.FONTS) - font_size]
		self.last_draw_text: str | None = None

	def _normalize_value(self, value):
		if self.value_round_decimal is not None:
			if self.value_round_decimal == 0:
				value = int(value)
			else:
				value = round(value, self.value_round_decimal)
				if isinstance(value, float) and value.is_integer():
					value = int(value)
		return value

	def set_xy(self):
		super().set_xy()

		# a bit of magic after playing around
		if self.v_align == 'top':
			self.y = int(self.bb_y - self.textbox[1] + self.bb_y)
		elif self.v_align == 'bottom':
			self.y = int(self.bb_y + self.y - self.textbox[1])

	def set_value(self, value):
		with self.value_lock:
			self.source_last_receive_time = time.time()

			# set the text from the template
			if value is None:
				self.text = 'N/A'
			else:
				text = self.template or ''
				if isinstance(value, dict):
					for key, value in value.items():
						text = text.replace(f'{{.{key}}}', f'{self._normalize_value(value)}')
				else:
					text = text.replace('{value}', f'{self._normalize_value(value)}')
				self.text = text

	def draw(self, draw: ImageDraw.ImageDraw, color: str):
		with self.value_lock:
			if self.match_schema and self.source_last_receive_time and time.time() - self.source_last_receive_time > 60:
				self.text = 'T/O'

			if self.last_draw_text != self.text:
				self.textbox = draw.textbbox((self.bb_x, self.bb_y), self.text, self.font)
				self.height = int(self.textbox[3] - self.textbox[1])
				self.width = int(self.textbox[2] - self.textbox[0])
				self.set_xy()
				self.last_draw_text = self.text

			draw.text(
				(self.x, self.y),
				self.text,
				font=self.font,
				fill=color,
				stroke_width=self.stroke_width,
			)

class ImageElement(Element):
	def __init__(self, conf: OledConfig.Screen.Box):
		super().__init__(conf)

		image_conf: OledConfig.Screen.Box.Image = self.config # type: ignore
		image_width = image_conf.width
		image_height = image_conf.height
		file_name = image_conf.file_name
		file_path = str(pathlib.Path(__file__).resolve().parent.joinpath('images', file_name))

		self.image = Image.open(file_path)

		if not image_width or not image_height:
			image_width = image_width if image_width else self.image.width
			image_height = image_height if image_height else self.image.height
			self.image.thumbnail((image_width, image_height))
		else:
			self.image = self.image.resize((image_width, image_height))

		if self.v_flip:
			self.image = self.image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
		if self.h_flip:
			self.image = self.image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

		self.width = self.image.width
		self.height = self.image.height
		self.set_xy()

	def draw(self, draw: ImageDraw.ImageDraw, color: str):
		with self.value_lock:
			if self.animate:
				if self.animate.type == AnimateConfig.TYPE_SWIM_LEFT_RIGHT:
					self.x += self.animate.pixel_jump_x
					self.y += self.animate.pixel_jump_y * self.animate.travel_direction_y

					if self.x > self.bb_x + self.bb_width:
						self.x = self.bb_x - self.width

					if self.y > self.bb_y + self.bb_height - self.height:
						self.y = self.bb_y + self.bb_height - self.height
						self.animate.travel_direction_y = -1
					elif self.y < self.bb_y:
						self.y = self.bb_y
						self.animate.travel_direction_y = 1

			draw.bitmap(
				(self.x, self.y),
				self.image,
				fill=color,
			)

class Screen:
	def __init__(self, conf: OledConfig.Screen):
		self.display_secs: int | float = conf.display_secs
		self.background_fill: str = conf.background
		self.border_fill: str | None = conf.border
		self.content_fill: str = 'white' if self.background_fill == 'black' else 'black'
		self.elements: list[Element] = []

		for box in conf.boxes:
			if box.text is not None:
				self.elements.append(TextElement(box))
			elif box.image is not None:
				self.elements.append(ImageElement(box))

	def has_animation(self) -> bool:
		for element in self.elements:
			if element.animate:
				return True
		return False

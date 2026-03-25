import rhpy
import fitz
import re
from statistics import median
from typing import Any

log = rhpy.logs('pdf')


def extract_text(pdf_bytes: bytes) -> str:
	doc = fitz.open(stream=pdf_bytes, filetype='pdf')
	pages = []
	for page in doc:
		page_text = page.get_text('text')
		if isinstance(page_text, str):
			pages.append(page_text)
	doc.close()
	return ''.join(pages).strip()


class PdfToTtsConverter:
	def __init__(self, use_ssml: bool = False):
		self.use_ssml = use_ssml
		self.output_lines: list[str] = []
		self.current_code_block: list[str] = []
		self.list_pattern = re.compile(r'^(\d+[\.\)]|[-•])\s+')
		self.toc_line_pattern = re.compile(r'.+\s+\d{1,4}$')

	def _looks_like_toc(self, lines: list[dict[str, Any]]) -> bool:
		if len(lines) < 2:
			return False
		matches = sum(1 for l in lines if self.toc_line_pattern.match(l['text']))
		return matches >= len(lines) * 0.7

	def _flush_code(self) -> None:
		if not self.current_code_block:
			return
		if self.use_ssml:
			self.output_lines.append('<break time="300ms"/>')
			self.output_lines.append('<speak><prosody rate="slow">Code example:</prosody></speak>')
		else:
			self.output_lines.append('Code example:')
		for line in self.current_code_block:
			self.output_lines.append(line)
		if self.use_ssml:
			self.output_lines.append('<speak><prosody rate="slow">End of code.</prosody></speak>')
			self.output_lines.append('<break time="300ms"/>')
		else:
			self.output_lines.append('End of code.\n')
		self.current_code_block = []

	def _looks_like_code(self, text: str, fonts: list[str]) -> bool:
		mono_font = any('Mono' in f or 'Courier' in f for f in fonts)
		code_symbols = re.findall(r'[{}();=<>\[\]]', text)
		return mono_font or len(code_symbols) / max(len(text), 1) > 0.3

	def _process_toc(self, lines: list[dict[str, Any]]) -> None:
		toc_label = '<p>Table of Contents:</p>' if self.use_ssml else 'Table of Contents:'
		self.output_lines.append(toc_label)
		for l in lines:
			title = re.sub(r'\s+\d{1,4}$', '', l['text'])
			page_match = re.search(r'(\d{1,4})$', l['text'])
			if page_match:
				page_num = page_match.group(1)
				self.output_lines.append(f'{title}, page {page_num}.')
			else:
				self.output_lines.append(title)
		self.output_lines.append('')

	def _extract_lines_from_block(self, block: dict[str, Any]) -> list[dict[str, Any]]:
		lines = []
		for line in block['lines']:
			line_text = ''
			fonts = []
			font_size = 0
			x0 = line['bbox'][0]
			for span in line['spans']:
				line_text += span['text']
				fonts.append(span['font'])
				font_size = max(font_size, span['size'])
			text = line_text.strip()
			if text:
				lines.append({'text': text, 'fonts': fonts, 'font_size': font_size, 'x0': x0})
		return lines

	def _cleanup_output(self) -> str:
		cleaned = []
		for line in self.output_lines:
			if line.strip() == '':
				if cleaned and cleaned[-1] == '':
					continue
				cleaned.append('')
			else:
				cleaned.append(line.strip())
		return '\n'.join(cleaned)


class AdvancedTtsConverter(PdfToTtsConverter):
	def __init__(self, use_ssml: bool = True):
		super().__init__(use_ssml)
		self.current_list_stack: list[str] = []
		self.list_indent_threshold = 40

	def _flush_list(self) -> None:
		if not self.current_list_stack:
			return
		if self.use_ssml:
			self.output_lines.append('<break time="400ms"/>')
			self.output_lines.append('<p>List:</p>')
		else:
			self.output_lines.append('List:')
		for item in self.current_list_stack:
			self.output_lines.append(f'- {item.strip()}')
		self.output_lines.append('')
		self.current_list_stack = []

	def convert(self, pdf_bytes: bytes) -> str:
		doc = fitz.open(stream=pdf_bytes, filetype='pdf')

		for page_number, page in enumerate(doc, start=1):  # type: ignore[arg-type]
			page_dict = page.get_text('dict')
			font_sizes = [span['size'] for block in page_dict['blocks'] if 'lines' in block
						  for line in block['lines'] for span in line['spans']]
			body_font_size = median(font_sizes) if font_sizes else 12
			previous_line_text = ''

			for block in page_dict['blocks']:
				if 'lines' not in block:
					continue

				lines = self._extract_lines_from_block(block)
				if not lines:
					continue

				if not all(self.list_pattern.match(l['text']) for l in lines):
					self._flush_list()

				if self._looks_like_toc(lines):
					self._flush_list()
					self._process_toc(lines)
					continue

				for l in lines:
					text = l['text']
					x0 = l['x0']
					font_size = l['font_size']
					fonts = l['fonts']

					if font_size > body_font_size * 1.35:
						self._flush_list()
						self._flush_code()
						self.output_lines.append(f'\nHeading: {text}\n')
						previous_line_text = ''
						continue

					list_match = self.list_pattern.match(text)
					if list_match:
						self._flush_code()
						if x0 > self.list_indent_threshold:
							if self.current_list_stack:
								self.current_list_stack[-1] += ' ' + self.list_pattern.sub('', text)
							else:
								self.current_list_stack.append(self.list_pattern.sub('', text))
						else:
							self.current_list_stack.append(self.list_pattern.sub('', text))
						continue

					if self.current_list_stack and x0 > self.list_indent_threshold:
						self.current_list_stack[-1] += ' ' + text
						continue

					if self._looks_like_code(text, fonts):
						self.current_code_block.append(text)
						continue
					else:
						self._flush_code()

					if previous_line_text and not previous_line_text.endswith(('.', ':', '?', '!', '\n')):
						self.output_lines[-1] += ' ' + text
					else:
						self.output_lines.append(text)
					previous_line_text = text

			self._flush_list()
			self._flush_code()
			self.output_lines.append(f'[End of page {page_number}]\n')

		self._flush_list()
		self._flush_code()
		return self._cleanup_output()


class TechnicalTtsConverter(PdfToTtsConverter):
	def __init__(self, use_ssml: bool = False):
		super().__init__(use_ssml)
		self.current_list_items: list[str] = []
		self.in_list = False
		self.list_continuation_threshold = 50

	def _flush_list(self) -> None:
		if not self.current_list_items:
			return
		if self.use_ssml:
			self.output_lines.append('<break time="400ms"/>')
		list_label = '<p>List:</p>' if self.use_ssml else 'List:'
		self.output_lines.append(list_label)
		for item in self.current_list_items:
			self.output_lines.append(f'- {item.strip()}')
		self.output_lines.append('')
		self.current_list_items = []
		self.in_list = False

	def convert(self, pdf_bytes: bytes) -> str:
		doc = fitz.open(stream=pdf_bytes, filetype='pdf')

		for page_number, page in enumerate(doc, start=1):  # type: ignore[arg-type]
			page_dict = page.get_text('dict')
			font_sizes = [span['size'] for block in page_dict['blocks'] if 'lines' in block
						  for line in block['lines'] for span in line['spans']]
			body_font_size = median(font_sizes) if font_sizes else 12
			previous_line_text = ''

			for block in page_dict['blocks']:
				if 'lines' not in block:
					continue

				lines = self._extract_lines_from_block(block)
				if not lines:
					continue

				if not all(self.list_pattern.match(l['text']) for l in lines):
					self._flush_list()

				if self._looks_like_toc(lines):
					self._flush_list()
					self._process_toc(lines)
					continue

				for l in lines:
					text = l['text']
					x0 = l['x0']
					font_size = l['font_size']
					fonts = l['fonts']

					if font_size > body_font_size * 1.35:
						self._flush_list()
						self._flush_code()
						self.output_lines.append(f'\nHeading: {text}\n')
						previous_line_text = ''
						continue

					list_match = self.list_pattern.match(text)
					if list_match:
						self._flush_code()
						item_text = self.list_pattern.sub('', text)
						self.current_list_items.append(item_text)
						self.in_list = True
						previous_line_text = ''
						continue

					if self.in_list and x0 > self.list_continuation_threshold:
						self.current_list_items[-1] += ' ' + text
						continue

					if self._looks_like_code(text, fonts):
						self._flush_list()
						self.current_code_block.append(text)
						previous_line_text = ''
						continue
					else:
						self._flush_code()

					if previous_line_text and not previous_line_text.endswith(('.', ':', '?', '!', '\n')):
						self.output_lines[-1] += ' ' + text
					else:
						self.output_lines.append(text)
					previous_line_text = text

			self._flush_list()
			self._flush_code()
			self.output_lines.append(f'[End of page {page_number}]\n')

		self._flush_list()
		self._flush_code()
		return self._cleanup_output()


class SimpleTtsConverter(PdfToTtsConverter):
	def __init__(self):
		super().__init__(use_ssml=False)
		self.current_list_items: list[str] = []
		self.in_list = False

	def _flush_list(self) -> None:
		if not self.current_list_items:
			return
		self.output_lines.append('List:')
		for item in self.current_list_items:
			self.output_lines.append(f'- {item.strip()}')
		self.output_lines.append('')
		self.current_list_items = []
		self.in_list = False

	def convert(self, pdf_bytes: bytes) -> str:
		doc = fitz.open(stream=pdf_bytes, filetype='pdf')

		for page_number, page in enumerate(doc, start=1):  # type: ignore[arg-type]
			page_dict = page.get_text('dict')
			font_sizes = [span['size'] for block in page_dict['blocks'] if 'lines' in block
						  for line in block['lines'] for span in line['spans']]
			body_font_size = median(font_sizes) if font_sizes else 12

			for block in page_dict['blocks']:
				if 'lines' not in block:
					continue

				for line in block['lines']:
					line_text = ''
					font_size = 0
					x0 = line['bbox'][0]
					for span in line['spans']:
						line_text += span['text']
						font_size = max(font_size, span['size'])

					text = line_text.strip()
					if not text:
						continue

					if font_size > body_font_size * 1.35:
						self._flush_list()
						self.output_lines.append(f'\nHeading: {text}\n')
						continue

					list_match = self.list_pattern.match(text)
					if list_match:
						item_text = self.list_pattern.sub('', text)
						self.current_list_items.append(item_text)
						self.in_list = True
						continue

					if self.in_list and x0 > 50:
						self.current_list_items[-1] += ' ' + text
						continue

					if self.in_list:
						self._flush_list()

					if re.search(r'[{}();=<>\[\]]', text):
						self.output_lines.append('Code example:')
						self.output_lines.append(text)
						self.output_lines.append('End of code.\n')
						continue

					if self.output_lines and not self.output_lines[-1].endswith(('.', ':', '?', '!')):
						self.output_lines[-1] += ' ' + text
					else:
						self.output_lines.append(text)

			self._flush_list()
			self.output_lines.append('')

		self._flush_list()
		return self._cleanup_output()


def pdf_to_advanced_tts(pdf_bytes: bytes, use_ssml: bool = True) -> str:
	converter = AdvancedTtsConverter(use_ssml)
	return converter.convert(pdf_bytes)


def pdf_to_technical_tts(pdf_bytes: bytes, use_ssml: bool = False) -> str:
	converter = TechnicalTtsConverter(use_ssml)
	return converter.convert(pdf_bytes)


def pdf_to_tts_friendly_text(pdf_bytes: bytes) -> str:
	converter = SimpleTtsConverter()
	return converter.convert(pdf_bytes)

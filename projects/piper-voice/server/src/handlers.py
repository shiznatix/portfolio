import json
from typing import Annotated, Literal, cast
from piper import SynthesisConfig
from pydantic import Field, StringConstraints, field_validator, model_validator
from datetime import datetime
import secrets
import subprocess
import tempfile
import time
import wave

import rhpy
from rhpy.web import HTTPContext, RequestInputError, RouteDecorators
import voices
from config import Config
import pdf
import history

class ExtractTextBody(rhpy.Model):
	contents: bytes

	@field_validator('contents')
	def validate_contents(cls, v):
		if not v.startswith(b'%PDF-'):
			raise ValueError('Uploaded file is not a valid PDF')
		return v

class SynthesizeBody(rhpy.Model):
	text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
	voice: str = Field(default_factory=lambda: Config.default_voice)
	length_scale: float = 1.0
	noise_scale: float = 0.0
	noise_w_scale: float = 0.0
	format: Literal['wav', 'ogg'] = 'wav'
	response: Literal['file', 'url'] = 'file'
	# computed
	id: str = Field(default_factory=lambda: secrets.token_hex(4))
	text_str: str = ''
	char_count: int = 0
	file_name: str = ''

	@model_validator(mode='after')
	def set_parsed_text(self):
		self.text_str = self.text.encode('utf-8', errors='replace').decode('utf-8')
		self.char_count = len(self.text_str)

		date_str = datetime.now().strftime('%d-%m-%y')
		self.file_name = '_'.join([
			date_str,
			f'{Config.get_short_voice_name(self.voice)}',
				f'{self.char_count}c'
				f'{rhpy.round(self.length_scale, 2)}l'
				f'{rhpy.round(self.noise_scale, 2)}n'
				f'{rhpy.round(self.noise_w_scale, 2)}nw',
			f'{self.id}',
		]) + f'.{self.format}'
		return self

	def response_data(self, *, file_size: float | None = None):
		data = {
			'file_name': self.file_name,
			'char_count': self.char_count,
			'voice': self.voice,
			'length_scale': self.length_scale,
			'noise_scale': self.noise_scale,
			'noise_w_scale': self.noise_w_scale,
		}
		if self.response == 'url':
			data['download_path'] = f'/history/{self.file_name}'
		if file_size is not None:
			data['file_size'] = file_size
		return rhpy.snake_to_camel(data)

	def response_data_str(self):
		return json.dumps(self.response_data())

	def synthesis_config(self):
		return SynthesisConfig(
			length_scale=self.length_scale,
			noise_scale=self.noise_scale,
			noise_w_scale=self.noise_w_scale,
		)

router = RouteDecorators()

@router.get('/voices')
async def get_voices():
	return {'voices': Config.voices_map, 'default': Config.get_short_voice_name()}

@router.get('/history/{file_name}')
async def get_file(ctx: HTTPContext, file_name: str):
	file_path = Config.history_dir / file_name
	if not file_path.exists():
		return {'error': f'Audio file not found: {file_path}'}, 404

	ext = file_path.suffix.lower().removeprefix('.')
	if ext not in ['ogg', 'wav']:
		return {'error': 'Invalid file type'}, 400
	ext = cast(Literal['wav', 'ogg'], ext)

	return ctx.audio(file_path, ext, file_name=file_name)

@router.post('/extract-text', body=ExtractTextBody)
async def extract_text(body: ExtractTextBody):
	return pdf.pdf_to_technical_tts(body.contents)

@router.post('/synthesize', body=SynthesizeBody, simultaneous=2)
async def synthesize(ctx: HTTPContext, body: SynthesizeBody):
	if body.char_count > Config.max_chars:
		raise RequestInputError(f'Text length {body.char_count} exceeds maximum of {Config.max_chars}')

	voice = voices.get(body.voice)

	with tempfile.NamedTemporaryFile(suffix='.wav') as wav_file:
		with wave.open(wav_file.name, 'wb') as wf:
			ctx.log.info(f'Starting synthesis chars:{body.char_count} voice:{body.voice} format:{body.format}')

			start_time = time.time()
			await ctx.thread(voice.synthesize_wav, body.text_str, wf, body.synthesis_config())
			elapsed_time = rhpy.seconds_elapsed(start_time)

			ctx.log.info(
				f'Synthesized chars:{body.char_count} time:{elapsed_time}s voice:{body.voice} format:{body.format} '
				f'len_scale:{body.length_scale} noise:{body.noise_scale} noise_w:{body.noise_scale}'
			)

			if body.format == 'wav':
				if body.response == 'url':
					_, file_size = await ctx.thread(history.save_audio, tmp_path=wav_file.name, dest_file_name=body.file_name)
					return body.response_data(file_size=file_size)
				ctx.header('X-Piper-Voice-Result', body.response_data_str())
				return ctx.audio(wav_file.name, 'wav', file_name=body.file_name)

			with tempfile.NamedTemporaryFile(suffix='.ogg') as ogg_file:
				cmd = ['ffmpeg', '-y', '-i', wav_file.name, '-c:a', 'libvorbis', '-q:a', '5', ogg_file.name]
				await ctx.thread(lambda: subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE))

				if body.response == 'url':
					_, file_size = await ctx.thread(history.save_audio, tmp_path=ogg_file.name, dest_file_name=body.file_name)
					return body.response_data(file_size=file_size)
				ctx.header('X-Piper-Voice-Result', body.response_data_str())
				return ctx.audio(ogg_file.name, 'ogg', file_name=body.file_name)

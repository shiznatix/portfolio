import argparse
import socket
import sys
import json
from typing import Optional

import asyncio
import os

class Globals:
	_pid: int | None = None
	_args: argparse.Namespace | None = None

	@staticmethod
	def pid():
		if not Globals._pid:
			Globals._pid = os.getpid()
		return Globals._pid

	@staticmethod
	def args():
		if not Globals._args:
			parser = argparse.ArgumentParser()
			parser.add_argument('--name', required=True)
			parser.add_argument('--width', required=True, type=int)
			parser.add_argument('--height', required=True, type=int)
			parser.add_argument('--host', required=True, type=str)
			parser.add_argument('--in-port', required=True, type=int)
			parser.add_argument('--out-port', required=True, type=int)
			parser.add_argument('--detectors', required=True, type=str)
			parser.add_argument('--parent-pid', required=True, type=int)
			Globals._args = parser.parse_args()
		return Globals._args

def log(msg: str):
	prefix = ''.join([
		'[rhimgd.py]',
		f'({Globals.args().name})',
		f'<{Globals.args().parent_pid}>',
		f'|{Globals.pid()}|',
	])
	print(f'{prefix} {msg}', file=sys.stderr)

async def close_writer(label: str, writer: asyncio.StreamWriter):
	try:
		writer.close()
		await writer.wait_closed()
	except Exception as e:
		log(f'{label.upper()} Error closing connection: {e}')

async def stdin_to_socket(writer: asyncio.StreamWriter, header: bytes, frame_size: int, first_frame: Optional[bytes] = None):
	# send header first
	writer.write(header)
	await writer.drain()

	# send the first frame if provided
	if first_frame is not None:
		writer.write(first_frame)
		await writer.drain()

	# then pump stdin frames
	loop = asyncio.get_running_loop()
	while True:
		data = await loop.run_in_executor(None, sys.stdin.buffer.read, frame_size)
		if not data:
			break
		writer.write(data)
		if writer.transport.get_write_buffer_size() > frame_size * 2:
			await writer.drain()
	writer.close()
	await writer.wait_closed()

async def socket_to_stdout(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, header: bytes, frame_size: int):
	# send header first
	writer.write(header)
	if writer.transport.get_write_buffer_size() > frame_size * 2:
		await writer.drain()

	while True:
		try:
			data = await reader.readexactly(frame_size)
		except asyncio.IncompleteReadError:
			break
		os.write(sys.stdout.fileno(), data)

async def main():
	log('Start main()')
	args = Globals.args()
	frame_size = args.width * args.height * 3  # RGB24 = 3 bytes per pixel
	header_dict = {
		'name': args.name,
		'width': args.width,
		'height': args.height,
		'frameSize': frame_size,
		'detectors': args.detectors.split(','),
	}
	header_json = json.dumps(header_dict)
	header = f'{header_json}\n'.encode('utf-8')

	# Ensure we get a frame from stdin before opening connections
	log('Waiting for first frame from stdin')
	loop = asyncio.get_running_loop()
	first_frame = await loop.run_in_executor(None, sys.stdin.buffer.read, frame_size)
	if not first_frame:
		raise RuntimeError('No frame received from stdin')
	log('Received first frame from stdin')

	in_port = int(args.in_port)
	out_port = int(args.out_port)
	in_writer = None
	out_writer = None

	try:
		# connect to input
		log(f'Connecting to {args.host}:{in_port} (input)')
		_in_reader, in_writer = await asyncio.open_connection(args.host, in_port)
		in_writer.transport.get_extra_info('socket').setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
		# connect to output
		log(f'Connecting to {args.host}:{out_port} (output)')
		out_reader, out_writer = await asyncio.open_connection(args.host, out_port)
		out_writer.transport.get_extra_info('socket').setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

		# Run tasks concurrently
		log('Starting data pump tasks')
		await asyncio.gather(
			stdin_to_socket(in_writer, header, frame_size, first_frame=first_frame),
			socket_to_stdout(out_reader, out_writer, header, frame_size),
		)
	finally:
		log('Shutting down connections')
		if in_writer:
			log('Closing input connection')
			await close_writer('input', in_writer)
		if out_writer:
			log('Closing output connection')
			await close_writer('output', out_writer)
		log('Shutdown complete')

if __name__ == '__main__':
	try:
		log('Start')
		asyncio.run(main())
		log('*** EXIT_OK ***')
	except Exception as e:
		log(f'!!! ERROR !!!: {e}')
		print(e, file=sys.stderr)
		log('!!! EXIT_ERR !!!')
		sys.exit(1)

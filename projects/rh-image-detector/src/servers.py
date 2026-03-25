from typing import NamedTuple
from abc import ABC, abstractmethod
import socket
import select
import json

import numpy as np

import rhpy
from config import ModelName
from stats import ReceiveStats
import streams
import detectors
import notifiers
import draw

class Headers(NamedTuple):
	name: str
	width: int
	height: int
	frame_size: int
	detector_names: list[ModelName]

class Connection:
	def __init__(self, server_name: str, sock: socket.socket):
		self.sock = sock
		self.headers = self.read_headers()
		self.name = self.headers.name
		self.width = self.headers.width
		self.height = self.headers.height
		self.frame_size = self.headers.frame_size
		self.detector_names = self.headers.detector_names
		self.log = rhpy.logs(f'conn.{server_name}.{self.name}')
		self.stats = ReceiveStats(self.log)

	def read_headers(self):
		header = b''
		while not header.endswith(b'\n'):
			chunk = self.sock.recv(1)
			if not chunk:
				raise EOFError('Socket closed while reading header')
			header += chunk
		header_str = header.decode('utf-8').strip()
		header_dict = json.loads(header_str)

		return Headers(
			name=header_dict.get('name'),
			width=header_dict.get('width'),
			height=header_dict.get('height'),
			frame_size=header_dict.get('width') * header_dict.get('height') * 3,
			detector_names=header_dict.get('detectors')
		)

	def read(self, length: int) -> bytearray:
		buf = bytearray(length)
		view = memoryview(buf)
		pos = 0
		while pos < length:
			n = self.sock.recv_into(view[pos:])
			if not n:
				raise EOFError('Socket closed')
			pos += n
		return buf

	def send(self, data: bytes):
		self.sock.sendall(data)

	def close(self):
		self.sock.close()

class Server(ABC):
	def __init__(self, name: str, port: int):
		self.name = name
		self.log = rhpy.logs(f'srv.{name}')
		self.port = port
		self.server: socket.socket | None = None
		self.connections: rhpy.Threads = rhpy.Threads()
		self.timeout = 5.0

	@abstractmethod
	def handle_client(self, conn: Connection):
		pass

	def start(self):
		self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
		self.server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
		self.server.bind(('0.0.0.0', self.port))
		self.server.listen(5)
		self.log.info(f'Listening on port {self.port}')

	def close(self):
		self.connections.join()
		if self.server:
			self.log.info('Closing server socket')
			self.server.close()

	def run(self):
		self.log.info(f'Starting server on port {self.port}')

		try:
			self.start()
			while rhpy.running():
				rlist, _, _ = select.select([self.server], [], [], 1.0)
				if self.server and self.server in rlist:
					sock, _ = self.server.accept()
					sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
					sock.settimeout(self.timeout)
					conn = Connection(self.name, sock)
					self.connections.add(
						lambda: self.handle_client(conn),
						name=f'{self.name}.Conn.{conn.name}',
					)
		except Exception as e:
			self.log.exception(e)
			rhpy.quit(error=e)
		finally:
			rhpy.quit()
			self.log.info('Closing server')
			self.close()
			self.log.info('Closed server')

class InputServer(Server):
	def handle_client(self, conn: Connection):
		stream: streams.Stream | None = None

		try:
			conn.log.info('Connection established', extra={'headers': conn.headers})
			stream = streams.Manager.add_stream(conn.name)

			while rhpy.running():
				# Read frame data
				frame_bytes = conn.read(conn.frame_size)
				if not frame_bytes or len(frame_bytes) != conn.frame_size:
					conn.log.warning('Incomplete frame received, closing connection')
					break

				# Convert to numpy array (raw RGB)
				frame = np.frombuffer(frame_bytes, dtype=np.uint8)
				try:
					frame = frame.reshape((conn.height, conn.width, 3))
				except Exception as e:
					raise RuntimeError(f'Frame reshape error: {e}') from e

				detections = detectors.on_frame(frame, conn.detector_names)
				if detections:
					frame = draw.rects(frame.copy(), detections)
					conn.stats.detections(len(detections))

				stream.set_frame(frame)
				notifiers.on_frame(conn.name, detections)
				conn.stats.frame()
		except EOFError as e:
			conn.log.info(f'Connection closed by client: {e}')
		except Exception as e:
			conn.log.exception(e)
		finally:
			if stream:
				conn.log.info('Connection removing stream')
				streams.Manager.remove_stream(stream)
			conn.close()
			conn.log.info('Connection closed')

class OutputServer(Server):
	def handle_client(self, conn: Connection):
		try:
			conn.log.info('Connection established')
			stream = streams.Manager.get_stream(conn.name, retries=5)

			while rhpy.running():
				# reset stream every loop to handle stream removal
				stream = streams.Manager.get_stream(conn.name)
				frame = stream.wait_for_new_frame(timeout=self.timeout)
				if frame is None:
					conn.log.info('No new frame after timeout, closing connection')
					break

				conn.send(memoryview(frame))  # type: ignore[arg-type] # ndarray supports buffer protocol at runtime
				conn.stats.frame()
		except EOFError as e:
			conn.log.info(f'Connection closed by client: {e}')
		except Exception as e:
			conn.log.exception(e)
		finally:
			conn.close()
			conn.log.info('Connection closed')

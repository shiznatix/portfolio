import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Callable
import requests
from requests.adapters import HTTPAdapter

from . import logger
from .redis_client import get_redis_client

_OnError = Callable[[str, Exception], None]
class _Message:
	name: str
	url: str
	body: dict
	on_http_error: _OnError | None
	on_redis_error: _OnError | None

	def __init__(self, *, name: str, url: str, body: dict, on_http_error: _OnError | None = None, on_redis_error: _OnError | None = None):
		self.name = name
		self.url = url
		self.body = body
		self.on_http_error = on_http_error
		self.on_redis_error = on_redis_error

	def payload(self):
		return {'name': self.name, **self.body}

class _Publisher:
	__executor: ThreadPoolExecutor | None = None
	__thread_local: threading.local | None = None

	def __init__(self):
		self.log = logger.get('pub')

	@property
	def _executor(self) -> ThreadPoolExecutor:
		if self.__executor is None:
			self.__executor = ThreadPoolExecutor(max_workers=10)
		return self.__executor
	@property
	def _thread_local(self) -> threading.local:
		if self.__thread_local is None:
			self.__thread_local = threading.local()
		return self.__thread_local

	def _session(self) -> requests.Session:
		if not hasattr(self._thread_local, 'session'):
			session = requests.Session()
			adapter = HTTPAdapter(max_retries=0)
			session.mount('http://', adapter)
			session.mount('https://', adapter)
			self._thread_local.session = session
		return self._thread_local.session

	def _do_post(self, message: _Message):
		try:
			res = self._session().post(message.url, timeout=2, json=message.payload())
			res.raise_for_status()
		except Exception as e:
			if message.on_http_error is not None:
				message.on_http_error(message.url, e)
			else:
				self.log.getChild(f'post.{message.name}').error(f'Failed to post to receiver: {e}', extra={
					'url': message.url,
				})

	def publish(
		self,
		name: str,
		urls: list[str],
		*,
		body: dict,
		on_http_error: _OnError | None = None,
		on_redis_error: _OnError | None = None,
		quiet: bool = False,
	):
		for url in urls:
			message = _Message(name=name, url=url, body=body, on_http_error=on_http_error, on_redis_error=on_redis_error)
			try:
				if url.startswith('redis'):
					try:
						get_redis_client(url).publish(name, message.payload(), quiet=quiet)
					except Exception as e:
						if message.on_redis_error is not None:
							message.on_redis_error(url, e)
						else:
							raise e
				else:
					self._executor.submit(self._do_post, message)
			except Exception as e:
				self.log.getChild(f'send.{name}').error(f'Failed to send value to {url}: {e}')
_publisher = _Publisher()
def publish(
	name: str,
	urls: list[str],
	*,
	body: dict,
	on_http_error: _OnError | None = None,
	on_redis_error: _OnError | None = None,
	quiet: bool = False,
):
	_publisher.publish(name, urls, body=body, on_http_error=on_http_error, on_redis_error=on_redis_error, quiet=quiet)

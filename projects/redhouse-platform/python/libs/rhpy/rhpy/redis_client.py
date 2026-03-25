import json
from typing import Any, Callable, Type, TypeVar, overload

from pydantic import ValidationError
import redis as _redis
from redis.client import PubSubWorkerThread

from . import threads
from . import lifecycle
from .model import Model
from . import funcs
from . import logger


_M = TypeVar('_M', bound=Model)

class RedisClient:
	ValueType = str | int | float | bool | dict | list | Model

	def __init__(self, url: str, log: logger.Logger | None = None):
		self._pub_key_prefix = funcs.service_name()
		self._key_separator = ':'
		self._pubsub_threads: list[PubSubWorkerThread] = []
		self._log = log or logger.get('redis')

		if funcs.url_is_local(url):
			url = '/run/redis/redis-server.sock'
			self.conn: _redis.Redis = _redis.Redis(unix_socket_path=url)
		else:
			self.conn: _redis.Redis = _redis.Redis.from_url(url)

		self._log.info(f'Connected to Redis at {url}')
		lifecycle.on_quit(self.cleanup)

	def keys(self):
		return self.conn.keys()

	def last_value(self, key: str) -> str | None:
		if not key.startswith(self._pub_key_prefix):
			key = f'{self._pub_key_prefix}{self._key_separator}{key}'
		history_key = f'{key}{self._key_separator}history'
		return self.conn.lindex(history_key, 0) # pyright: ignore[reportReturnType]

	def publish(self, key: str, value: ValueType = '', *, quiet: bool = False):
		if self.conn is None or not self.conn.ping():
			self._log.error('Cannot publish to Redis: connection is not available')
			return

		if not key.startswith(self._pub_key_prefix):
			key = f'{self._pub_key_prefix}{self._key_separator}{key}'
		history_key = f'{key}{self._key_separator}history'
		if isinstance(value, (dict, list)):
			value = json.dumps(value)
		elif isinstance(value, Model):
			value = value.model_dump_json()

		self.conn.publish(key, value)
		self.conn.lpush(history_key, value)
		self.conn.ltrim(history_key, 0, 49)
		if not quiet:
			self._log.info(f'Published to Redis key: {key}', extra={'value': value})

	@overload
	def subscribe(self, key_pattern: str | list[str], callback: Callable[[dict], Any], *, sync_last_value: bool = False) -> None: ...
	@overload
	def subscribe(self, key_pattern: str | list[str], callback: Callable[[_M], Any], *, model: Type[_M], sync_last_value: bool = False) -> None: ...
	def subscribe(self, key_pattern: str | list[str], callback, *, model=None, sync_last_value: bool = False):
		if self.conn is None or not self.conn.ping():
			self._log.error('Cannot subscribe to Redis: connection is not available')
			return

		if model and issubclass(model, Model):
			def model_callback(message: dict):
				try:
					callback(model.model_validate(json.loads(message['data'])))
				except ValidationError as e:
					self._log.error(f'Model validation error for Redis message: {e}', extra={'message': message})
			final_callback = model_callback
		else:
			final_callback = callback

		key_patterns = [key_pattern] if isinstance(key_pattern, str) else key_pattern

		if sync_last_value:
			for pattern in key_patterns:
				last = self.last_value(pattern)
				if last is not None:
					final_callback({'data': last})

		pubsub = self.conn.pubsub()
		pubsub.psubscribe(**{pattern: final_callback for pattern in key_patterns})
		thread = pubsub.run_in_thread(sleep_time=0.01, daemon=True)
		thread.name = f'redis_pubsub_{"_".join(key_patterns)}'
		self._pubsub_threads.append(thread)
		threads.thread(thread)
		self._log.info(f'Subscribed to Redis key pattern: {key_pattern}')

	def cleanup(self):
		for t in self._pubsub_threads:
			t.stop()
		self._pubsub_threads.clear()
		if self.conn:
			self.conn.close()
			self._log.info('Redis connection closed')

_clients: dict[str, RedisClient] = {}
def get_redis_client(url: str, log: logger.Logger | None = None) -> RedisClient:
	if url not in _clients:
		_clients[url] = RedisClient(url, log)
	return _clients[url]

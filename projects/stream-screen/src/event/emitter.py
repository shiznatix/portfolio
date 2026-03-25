from __future__ import annotations
import os
from typing import List, Optional, Set
import queue
from concurrent.futures import ThreadPoolExecutor
import time

import rhpy
from .subscribers import Subscriber
from .stats import stats

log = rhpy.logs('event.emitter')

class QueuedEvent():
	def __init__(self, name: str, payload, subscribers: List[Subscriber], *, debug_key: Optional[str] = None):
		self.name = name
		self.timestamp = time.time()
		self.payload = payload
		self.subscribers = subscribers
		self.debug_key = debug_key

		if payload is None:
			self.key = name
		elif hasattr(payload,'__dataclass_fields__'):
			try:
				self.key = (name, hash(payload))
			except TypeError:
				self.key = (name, id(payload))
		else:
			self.key = (name, repr(payload))

_queue = queue.Queue(maxsize=200)
_queued_events: Set = set()
_queue_lock = rhpy.PerfLock('emitter.queue')
_max_workers = min(32, (os.cpu_count() or 4) * 4)
_executor = ThreadPoolExecutor(max_workers=_max_workers)

def _invoke_subscriber(subscriber: Subscriber, event: QueuedEvent):
	try:
		stats.start(event)
		if subscriber.arg_count > 0:
			subscriber.callback(event.payload)
		else:
			subscriber.callback()
	except Exception as e:
		# log.exception(e)
		log.error(f'Subscriber callback error: {e}', extra={
			'payload': event.payload,
			'subscriber': subscriber.debug_key,
		})
		stats.fail(event)
	finally:
		stats.done(event)

def enqueue(name: str, payload, subscribers: List[Subscriber], *, debug_key: Optional[str] = None):
	event = QueuedEvent(name, payload, subscribers, debug_key=debug_key)

	with _queue_lock:
		if event.key in _queued_events:
			stats.dup()
			return
		try:
			_queue.put_nowait(event)
			_queued_events.add(event.key)
		except Exception as e:
			log.error(f'Event queue full, dropping event {name}', extra={'payload': payload, 'error': str(e)})
			stats.overflow()

def run():
	stats.set_event_queue(_queue)
	try:
		while rhpy.running():
			try:
				event: QueuedEvent = _queue.get(timeout=0.01)
				while True:
					with _queue_lock:
						_queued_events.discard(event.key)
					stats.process(event)
					for subscriber in event.subscribers:
						_executor.submit(_invoke_subscriber, subscriber, event)
					_queue.task_done()
					event = _queue.get_nowait()
			except queue.Empty:
				pass
	except Exception as e:
		rhpy.quit(error=e)
		log.info(f'Error emitting events: {e}')
	finally:
		rhpy.quit()
		log.info('Event emitter stopped')

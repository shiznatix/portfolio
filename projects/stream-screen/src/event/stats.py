from __future__ import annotations
from abc import ABC, abstractmethod
import queue

import rhpy


log = rhpy.logs('event.emitter')

class _StatsBase(ABC):
	@abstractmethod
	def process(self, event): ...
	@abstractmethod
	def start(self, event): ...
	@abstractmethod
	def done(self, event): ...
	@abstractmethod
	def fail(self, event): ...
	@abstractmethod
	def dup(self): ...
	@abstractmethod
	def overflow(self): ...
	@abstractmethod
	def set_event_queue(self, q: queue.Queue): ...

class _Stats(_StatsBase):
	def __init__(self):
		log.setLevel(rhpy.INFO)
		self._q: queue.SimpleQueue = queue.SimpleQueue()
		self._event_queue: queue.Queue | None = None
		self._timer = rhpy.timer('event_stats', 10, self._log, True)

	def set_event_queue(self, q: queue.Queue):
		self._event_queue = q

	def process(self, event):
		self._q.put(('process', event))
	def start(self, event):
		self._q.put(('start', event))
	def done(self, event):
		self._q.put(('done', event))
	def fail(self, event):
		self._q.put(('fail', event))
	def dup(self):
		self._q.put(('dup', None))
	def overflow(self):
		self._q.put(('overflow', None))

	def _log(self):
		process = 0
		start = 0
		done = 0
		fail = 0
		names: dict[str, tuple[int, int]] = {}
		subs = 0
		dups = 0
		overflows = 0

		while not self._q.empty():
			kind, data = self._q.get_nowait()
			if kind == 'process':
				process += 1
				name_counts = names.get(data.name, (0, 0))
				names[data.name] = (name_counts[0] + 1, name_counts[1])
				subs += len(data.subscribers)
			elif kind == 'start':
				start += 1
				name_counts = names.get(data.name, (0, 0))
				names[data.name] = (name_counts[0], name_counts[1] + 1)
			elif kind == 'done':
				done += 1
			elif kind == 'fail':
				fail += 1
			elif kind == 'dup':
				dups += 1
			elif kind == 'overflow':
				overflows += 1

		log.info(
			f'process:{process} '
			f'start:{start} '
			f'done:{done} '
			f'fail:{fail} '
			f'subs:{subs} '
			f'dups:{dups} '
			f'overflows:{overflows} '
			f'pending:{self._event_queue.qsize() if self._event_queue else "?"}',
			extra={'names': names},
		)
		# if names:
		# 	print('------ EVENT STATS ------')
		# 	print(names)
		# 	print(f'  process:   {process} | start:     {start} | done:      {done} | fail:      {fail}')
		# 	print(f'  subs:      {subs} | dups:      {dups} | overflows: {overflows} | pending:   {self._event_queue.qsize() if self._event_queue else "?"}')
		# 	print('------ /event stats ------')

class _StatsNoop(_StatsBase):
	def process(self, _event): ...
	def start(self, _event): ...
	def done(self, _event): ...
	def fail(self, _event): ...
	def dup(self): ...
	def overflow(self): ...
	def set_event_queue(self, _q: queue.Queue): ...


class _StatsHolder(_StatsBase):
	def __init__(self):
		self._impl: _StatsBase = _StatsNoop()

	def init(self):
		self._impl = _Stats() if rhpy.perf_enabled() else _StatsNoop()

	def process(self, event):
		self._impl.process(event)
	def start(self, event):
		self._impl.start(event)
	def done(self, event):
		self._impl.done(event)
	def fail(self, event):
		self._impl.fail(event)
	def dup(self):
		self._impl.dup()
	def overflow(self):
		self._impl.overflow()
	def set_event_queue(self, q: queue.Queue):
		self._impl.set_event_queue(q)
stats = _StatsHolder()

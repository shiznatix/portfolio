from abc import ABC, abstractmethod
from collections import Counter

import rhpy
from gst.lib import Gst

class Stream(ABC):
	sink: Gst.Pad | None = None

	@property
	@abstractmethod
	def TYPE(self) -> str: ...

	def __init__(self, name: str, pipeline: Gst.Pipeline, compositor: Gst.Element):
		self.log = rhpy.logs(f'{name}.{self.TYPE}')
		self.name = name
		self.pipeline = pipeline
		self.compositor = compositor

	@abstractmethod
	def get_elements(self) -> list[Gst.Element]: ...

	def make_element_name(self, suffix: str) -> str:
		return f'{self.name}_{self.TYPE}_{suffix}'

	def set_elements_state(self, state: Gst.State):
		self.log.info(f'Setting state to {state.value_nick}')
		for element in self.get_elements():
			element.set_state(state)

	def sync_state_with_parent(self):
		for element in self.get_elements():
			element.sync_state_with_parent()

	def get_states_stats(self):
		states_list = [e.get_state(0)[1].value_nick for e in self.get_elements()]
		states_counter = Counter(states_list)
		return ','.join(f'{state}:{count}' for state, count in states_counter.items())

	def get_elements_states(self, *, with_state: Gst.State | None = None, without_state: Gst.State | None = None):
		elements = self.get_elements()
		result = []
		for e in elements:
			state = e.get_state(0)[1]
			if with_state is not None and state != with_state:
				continue
			if without_state is not None and state == without_state:
				continue
			result.append(f'{e.get_name()}:{state.value_nick}')
		return ','.join(result)

	def cleanup(self):
		self.log.info('Cleaning up stream')
		if self.sink is not None:
			self.compositor.release_request_pad(self.sink)
			self.sink = None
		for element in self.get_elements():
			element.set_locked_state(False)
			element.set_state(Gst.State.NULL)
			ret, state, _ = element.get_state(5 * Gst.SECOND)
			if ret == Gst.StateChangeReturn.ASYNC:
				self.log.warning(f'Element {element.get_name()} NULL transition timed out ({state.value_nick}), waiting...')
				element.set_locked_state(False)
				element.set_state(Gst.State.NULL)
				element.get_state(5 * Gst.SECOND) # 5 more seconds just in case
			self.pipeline.remove(element)

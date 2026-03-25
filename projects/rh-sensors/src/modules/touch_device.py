from typing import Optional, Dict
import evdev

from sensors.event_input_device import EventInputDeviceSensor

MODULE = 'touch-device'

class Sensor(EventInputDeviceSensor):
	module: str = MODULE

	def scale_coordinate(self, val: int, min_raw: int, max_raw: Optional[int], max_device: Optional[int]):
		val = min(max(val, min_raw), max_raw if max_raw is not None else val)
		if max_raw is None or max_device is None:
			return val # fallback, no scaling
		return int((val - min_raw) * (max_device - 1) / (max_raw - min_raw))

	def get_value(self, events: list[evdev.InputEvent]):
		touch_down_time: Optional[float] = None
		touch_up_time: Optional[float] = None
		# start_pos: Optional[Tuple[Optional[int], Optional[int]]] = None
		# end_pos: Optional[Tuple[Optional[int], Optional[int]]] = None
		# last_pos: Optional[Tuple[Optional[int], Optional[int]]] = None
		# gesture: Optional[Dict] = None

		# Collect raw positions
		raw_start_x: Optional[int] = None
		raw_start_y: Optional[int] = None
		raw_end_x: Optional[int] = None
		raw_end_y: Optional[int] = None

		for event in events:
			if event.type == evdev.ecodes.EV_KEY and event.code == evdev.ecodes.BTN_TOUCH:
				if event.value == 1:
					touch_down_time = event.timestamp()
				elif event.value == 0:
					touch_up_time = event.timestamp()
			elif event.type == evdev.ecodes.EV_ABS:
				if event.code == evdev.ecodes.ABS_X:
					if raw_start_x is None:
						raw_start_x = event.value
					raw_end_x = event.value
				elif event.code == evdev.ecodes.ABS_Y:
					if raw_start_y is None:
						raw_start_y = event.value
					raw_end_y = event.value

		if touch_down_time is None or touch_up_time is None or raw_start_x is None or raw_start_y is None or raw_end_x is None or raw_end_y is None:
			return None

		# swap and scale coordinates
		dev_min_x = self.input_event_min_x
		dev_max_x = self.input_event_max_x
		dev_min_y = self.input_event_min_y
		dev_max_y = self.input_event_max_y
		if self.input_event_swap_xy:
			raw_start_x, raw_start_y = raw_start_y, raw_start_x
			raw_end_x, raw_end_y = raw_end_y, raw_end_x
			scaled_start_x = self.scale_coordinate(raw_start_x, dev_min_y, dev_max_y, self.device_width)
			scaled_start_y = self.scale_coordinate(raw_start_y, dev_min_x, dev_max_x, self.device_height)
			scaled_end_x = self.scale_coordinate(raw_end_x, dev_min_y, dev_max_y, self.device_width)
			scaled_end_y = self.scale_coordinate(raw_end_y, dev_min_x, dev_max_x, self.device_height)
		else:
			scaled_start_x = self.scale_coordinate(raw_start_x, dev_min_x, dev_max_x, self.device_width)
			scaled_start_y = self.scale_coordinate(raw_start_y, dev_min_y, dev_max_y, self.device_height)
			scaled_end_x = self.scale_coordinate(raw_end_x, dev_min_x, dev_max_x, self.device_width)
			scaled_end_y = self.scale_coordinate(raw_end_y, dev_min_y, dev_max_y, self.device_height)

		# axis inversion
		if self.input_event_invert_x and self.device_width:
			scaled_start_x = (self.device_width - 1) - scaled_start_x
			scaled_end_x = (self.device_width - 1) - scaled_end_x
		if self.input_event_invert_y and self.device_height:
			scaled_start_y = (self.device_height - 1) - scaled_start_y
			scaled_end_y = (self.device_height - 1) - scaled_end_y

		# calculate gesture parameters
		duration: float = round(touch_up_time - touch_down_time, 2)
		delta_x: int = scaled_end_x - scaled_start_x
		delta_y: int = scaled_end_y - scaled_start_y
		abs_delta_x: int = abs(delta_x)
		abs_delta_y: int = abs(delta_y)

		gesture: Optional[Dict] = None

		if abs_delta_x < self.tap_max_distance and abs_delta_y < self.tap_max_distance:
			if duration < self.long_press_min_sec:
				gesture = {'gesture': 'tap'}
			else:
				gesture = {'gesture': 'press', 'duration': duration}
			gesture['x'] = int((scaled_start_x + scaled_end_x) // 2)
			gesture['y'] = int((scaled_start_y + scaled_end_y) // 2)
		elif (abs_delta_x > self.swipe_min_distance or abs_delta_y > self.swipe_min_distance) and (duration > self.swipe_min_sec and duration < self.swipe_max_sec):
			if abs_delta_y > abs_delta_x:
				if delta_y < 0:
					gesture = {'gesture': 'up'}
				else:
					gesture = {'gesture': 'down'}
			else:
				if delta_x > 0:
					gesture = {'gesture': 'right'}
				else:
					gesture = {'gesture': 'left'}

		if gesture:
			self.log.info(
				f'{gesture.get("type")} sec:{duration} dx:{abs_delta_x} dy:{abs_delta_y} '
				f'start:{scaled_start_x},{scaled_start_y} end:{scaled_end_x},{scaled_end_y} '
				f'raw_start:{raw_start_x},{raw_start_y} raw_end:{raw_end_x},{raw_end_y}'
			)
		else:
			self.log.warning('No gesture matched events')

		return gesture

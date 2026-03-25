import calendar
from datetime import datetime
import json
import os
from pathlib import Path
from typing import Literal, overload, Any
import time
import socket
from urllib.parse import urlparse

import dateutil
import netifaces

def service_name() -> str:
	if name := os.environ.get('SERVICE_NAME'):
		return name
	cwd = Path.cwd()
	name = cwd.name
	if name in ('client', 'server', 'service'):
		name = cwd.parent.name
	return name

@overload
def camel_to_snake(data: str) -> str: ...
@overload
def camel_to_snake(data: dict) -> dict: ...
@overload
def camel_to_snake(data: list) -> list: ...
def camel_to_snake(data: Any) -> Any:
	if isinstance(data, str):
		parts = []
		for c in data:
			if c.isupper():
				parts.append('_')
				parts.append(c.lower())
			else:
				parts.append(c)
		return ''.join(parts).lstrip('_')
	elif isinstance(data, list):
		return [camel_to_snake(item) if isinstance(item, (dict, list)) else item for item in data]
	elif isinstance(data, dict):
		return {
			camel_to_snake(''.join([word.capitalize() if i > 0 else word for i, word in enumerate(k.split('_'))])): camel_to_snake(v) if isinstance(v, (dict, list)) else v
			for k, v in data.items()
		}
	else:
		return data

@overload
def snake_to_camel(data: str) -> str: ...
@overload
def snake_to_camel(data: dict) -> dict: ...
@overload
def snake_to_camel(data: list) -> list: ...
def snake_to_camel(data: Any) -> Any:
	if isinstance(data, str):
		parts = data.split('_')
		return ''.join([word.capitalize() if i > 0 else word for i, word in enumerate(parts)])
	elif isinstance(data, list):
		return [snake_to_camel(item) if isinstance(item, (dict, list)) else item for item in data]
	elif isinstance(data, dict):
		return {
			snake_to_camel(k): snake_to_camel(v) if isinstance(v, (dict, list)) else v
			for k, v in data.items()
		}
	else:
		return data

def days_elapsed(since_timestamp: int | float):
	return int((time.time() - since_timestamp) / (60 * 60 * 24))

def days_to_seconds(days: int):
	return 60 * 60 * 24 * days

def seconds_elapsed(since_timestamp: int | float):
	val = round(time.time() - since_timestamp, 1)
	if val == int(val):
		return int(val)
	return val

def second_of_day() -> int:
	current_time = datetime.now()
	return current_time.hour * 3600 + current_time.minute * 60 + current_time.second

def relative_day(date_str: str) -> str:
	today = datetime.today()
	target_date = dateutil.parser.parse(date_str).date()
	today_date = today.date()
	delta = (target_date - today_date).days

	if delta == 0:
		return 'today'
	elif delta == -1:
		return 'yesterday'
	elif delta == 1:
		return 'tomorrow'
	else:
		day_name = calendar.day_name[target_date.weekday()]
		if delta < 0:
			return f'this past {day_name}'
		else:
			return day_name

def network_info():
	hostname = socket.gethostname()
	ips = set()
	for iface in netifaces.interfaces():
		addrs = netifaces.ifaddresses(iface).get(netifaces.AF_INET, [])
		for addr in addrs:
			ip = addr.get('addr')
			if ip and not ip.startswith('127.') and not ip.startswith('169.254.'):
				ips.add(ip)
	return (hostname, sorted(ips))

def ip_is_local(ip: str) -> bool:
	if ip == 'localhost' or ip.startswith('127.') or ip.startswith('169.254.'):
		return True
	_, local_ips = network_info()
	return ip in local_ips

def url_is_local(url: str) -> bool:
	try:
		url_ip = urlparse(url).hostname
		return ip_is_local(url_ip or url)
	except Exception:
		return False

def uptime_sec():
	with open('/proc/uptime', 'r', encoding='utf-8') as f:
		return int(float(f.readline().split()[0]))

def rounded(value: float, decimals: int = 0) -> int | float:
	v = round(value, decimals)
	if v == int(v):
		return int(v)
	return v

def pin(gpio: int):
	# lazy import to avoid warnings if not on a microcontroller
	import microcontroller # pylint: disable=import-outside-toplevel

	return microcontroller.Pin(gpio)

_SIZE_UNITS = {'b': 1, 'kb': 1024, 'mb': 1024**2, 'gb': 1024**3}

def convert_size(size_bytes: int, unit: Literal['b', 'kb', 'mb', 'gb']) -> int:
	return size_bytes // _SIZE_UNITS[unit]

def file_size(path: str | Path, unit: Literal['b', 'kb', 'mb', 'gb'] = 'b') -> int:
	return convert_size(Path(path).stat().st_size, unit)

_JSON_SCHEMA_KEYS = {'$schema', '$id', '$defs', 'properties', 'allOf', 'anyOf', 'oneOf', '$ref'}

def is_json_schema(d: dict) -> bool:
	return bool(_JSON_SCHEMA_KEYS & d.keys())

def pretty_dict_str(d: dict, indent: int = 0):
	lines = []
	for key, value in d.items():
		line = ' ' * indent + f'{key}:'
		if isinstance(value, (dict, list)):
			lines.append(line)
			lines.append(pretty_str(value, indent + 2))
		else:
			lines.append(f'{line} {value}')
	return '\n'.join(lines)

def pretty_list_str(lst: list, indent: int = 0):
	lines = []
	for item in lst:
		prefix = ' ' * indent + '-'
		if isinstance(item, (dict, list)):
			content_lines = pretty_str(item, indent + 2).split('\n')
			lines.append(f'{prefix} {content_lines[0].lstrip()}')
			for cl in content_lines[1:]:
				lines.append(cl)
		else:
			lines.append(f'{prefix} {item}')
	return '\n'.join(lines)

def pretty_str(val: Any, indent: int = 0) -> str:
	if isinstance(val, dict):
		if is_json_schema(val):
			return ' ' * indent + '**json-schema**'
		return pretty_dict_str(val, indent)
	elif isinstance(val, list):
		return pretty_list_str(val, indent)
	else:
		return ' ' * indent + str(val)

def print_pretty(key: str, obj: Any, *, as_json: bool = False, one_line: bool = False):
	print(f'----------{key}----------', flush=True)

	d: list[dict] = obj if isinstance(obj, list) else [vars(obj)] if hasattr(obj, '__dict__') else [obj]
	for i, item in enumerate(d):
		item = item if isinstance(item, dict) else vars(item) if hasattr(item, '__dict__') else item
		if as_json:
			print(json.dumps(item))
		else:
			if isinstance(item, dict):
				for key, value in item.items():
					print(f'{key}:', value, flush=True, end=(' ' if one_line else '\n'))
			else:
				print(item, flush=True, end=(' ' if one_line else '\n'))

			if one_line:
				print('', flush=True)

	print(f'----------/{key}/----------', flush=True)

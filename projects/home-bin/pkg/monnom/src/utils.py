def read_int(path, default=0):
	try:
		with open(path) as f:
			return int(f.read().strip())
	except (FileNotFoundError, ValueError, PermissionError):
		return default


def read_str(path, default='unknown'):
	try:
		with open(path) as f:
			return f.read().strip()
	except (FileNotFoundError, PermissionError):
		return default

def format_memory_human(mb_value):
	if mb_value is None:
		return 'N/A', ''

	if mb_value < 1:
		return f'{mb_value * 1024}', 'K'
	elif mb_value < 1024:
		return f'{mb_value}', 'M'
	else:
		gib_value = mb_value / 1024
		if gib_value == int(gib_value):
			return f'{int(gib_value)}', 'G'
		return f'{gib_value:.1f}', 'G'

def format_time_human(sec_value):
	if sec_value is None:
		return 'N/A', ''

	if sec_value < 60:
		if sec_value == int(sec_value):
			return f'{int(sec_value)}', 's'
		return f'{sec_value:.1f}', 's'
	elif sec_value < 3600:
		min_value = sec_value / 60
		if min_value == int(min_value):
			return f'{int(min_value)}', 'm'
		return f'{min_value:.1f}', 'm'
	else:
		hour_value = sec_value / 3600
		if hour_value == int(hour_value):
			return f'{int(hour_value)}', 'h'
		return f'{hour_value:.1f}', 'h'

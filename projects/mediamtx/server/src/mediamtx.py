import json
import sys
import os

import camera_path
from config import Config

def get_config_contents():
	bind_ip = Config.bind_ip
	lines = [
		'logLevel: info',
		'authMethod: internal',
		'authInternalUsers:',
		'- user: any',
		'  pass:',
		'  ips: []',
		'  permissions:',
		'  - action: publish',
		'  - action: read',
		'  - action: playback',
		'  - action: api',
		'  - action: metrics',
		'  - action: pprof',
		'hlsAlwaysRemux: yes',
	]

	for key in ['api', 'metrics', 'rtsp', 'rtmp', 'webrtc', 'hls', 'playback']:
		port = getattr(Config.ports, key, None)
		if port:
			lines.append(f'{key}: yes')
			lines.append(f'{key}Address: {bind_ip}:{port}')
		else:
			lines.append(f'{key}: no')

	paths = []
	for name in Config.cameras.keys():
		path = camera_path.builder(name)
		if path:
			paths.append(path.source())

	lines.extend(['paths:'] + paths)
	lines.append('')

	return '\n'.join(lines)

if __name__ == '__main__':
	try:
		script_dir = os.path.dirname(os.path.abspath(__file__))
		output_path = os.path.join(script_dir, '..', 'mediamtx.yml')

		yaml_content = get_config_contents()
		# print(yaml_content)

		with open(output_path, 'w', encoding='utf-8') as f:
			f.write(yaml_content)

		print(f'Successfully generated mediamtx.yml {output_path}')
	except FileNotFoundError:
		print('Error: config.json not found', file=sys.stderr)
		sys.exit(1)
	except json.JSONDecodeError as e:
		print(f'Error: Invalid JSON in config.json: {e}', file=sys.stderr)
		sys.exit(1)
	except Exception as e:
		print(f'Error: {e}', file=sys.stderr)
		sys.exit(1)

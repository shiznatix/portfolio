import subprocess

import rhpy

log = rhpy.logs('vpn')

def connected() -> bool:
	ps = subprocess.Popen(
		'nordvpn status | grep -q IP',
		shell=True,
		stdout=subprocess.PIPE,
		stderr=subprocess.STDOUT,
	)
	ps.communicate()
	if ps.returncode == 0:
		return True

	return False

def connect() -> None:
	log.info('Connecting to VPN')
	subprocess.run(['nordvpn', 'c'], check=True)

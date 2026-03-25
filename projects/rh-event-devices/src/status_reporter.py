import threading

import requests

import rhpy

log = rhpy.logs('sats.rprt')

def _send(name: str, value, urls: list[str]):
	for url in urls:
		try:
			response = requests.post(url, timeout=2, json={
				'name': name,
				'value': value,
			})

			if response.status_code != 200:
				log.error('Failed to post to receiver', extra={
					'url': url,
					'status_code': response.status_code,
				})
		except Exception:
			log.error('Failed to post to receiver', extra={
				'url': url,
			})

def send(name: str, value, urls: list[str]):
	threading.Thread(
		target=_send,
		args=(name, value, urls),
	).start()

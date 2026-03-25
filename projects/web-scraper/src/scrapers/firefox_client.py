import subprocess
import time
import random
import os
from threading import RLock

from marionette_driver.marionette import Keys, Marionette, WebElement

import rhpy
import utils

log = rhpy.logs('firefox')
alt_user_agents = [
	None,
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:123.0) Gecko/20100101 Firefox/123.0',
	'Mozilla/5.0 (X11; Linux i686; rv:123.0) Gecko/20100101 Firefox/123.0',
	'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
	'Mozilla/5.0 (X11; Ubuntu; Linux i686; rv:123.0) Gecko/20100101 Firefox/123.0',
	'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
	'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
]

class FirefoxClient(Marionette):
	_instance = None
	_lock = RLock()

	def __init__(self, *, host: str, port: int):
		super().__init__(host=host, port=port, startup_timeout=5)
		self._is_connected = False

	@classmethod
	def get_instance(cls, host: str = 'localhost', port: int = 2828):
		if cls._instance is None:
			with cls._lock:
				if cls._instance is None:
					cls._instance = cls(host=host, port=port)
		return cls._instance

	def get_lock(self):
		return self._lock

	def _start_session(self, capabilities=None, timeout=1.5, *, open_if_closed: bool = True):
		with self._lock:
			if self._is_connected:
				log.info('Already connected to Marionette')
				return

			firefox_started = False
			last_error = None
			for i in range(4):
				try:
					super().start_session(capabilities=capabilities, timeout=timeout)
					self._is_connected = True
					log.info('Connected to Marionette')
					return
				except TimeoutError as e:
					if not open_if_closed:
						raise e

					log.info(f'Timed out connecting to Marionette, retrying ({i})...')
					last_error = e
					if not firefox_started:
						log.info('Starting Marionette process via systemd scope')
						desktop_file = os.path.expanduser('~/.local/share/applications/web-scraper-firefox.desktop')
						subprocess.Popen(
							['gio', 'launch', desktop_file],
							stdin=subprocess.DEVNULL,
							stdout=subprocess.DEVNULL,
							stderr=subprocess.DEVNULL,
						)
						firefox_started = True
					time.sleep(1)

			self._is_connected = False
			raise last_error or RuntimeError('Failed to start Marionette session')

	def _ensure_connected(self, *, open_if_closed: bool = True):
		if not self._is_connected:
			log.info('Reconnecting to Firefox...')
			self._start_session(open_if_closed=open_if_closed)
		else:
			try:
				super().get_url()
			except Exception as e:
				log.warning(f'Connection lost, reconnecting: {e}')
				self._is_connected = False
				try:
					self.delete_session(send_request=False)
				except:
					pass
				self._start_session(open_if_closed=open_if_closed)

	def open(self, _type=None, _focus=False, _private=False):
		with self._lock:
			self._ensure_connected()
			return self

	def close(self):
		with self._lock:
			log.info('Closing Firefox')

			# Disconnect from Marionette session
			if self._is_connected:
				try:
					self.delete_session(send_request=True)
				except Exception as e:
					log.warning(f'Error closing Marionette session: {e}')
					self._is_connected = False

			# Stop the Firefox systemd scope
			try:
				log.info('Stopping Firefox systemd scope')
				result = subprocess.run(
					['systemctl', '--user', 'stop', 'web-scraper-firefox.scope'],
					capture_output=True,
					text=True,
					timeout=5,
					check=True,
				)
				if result.returncode == 0:
					log.info('Firefox scope stopped successfully')
				else:
					log.warning(f'Failed to stop Firefox scope: {result.stderr}')
			except Exception as e:
				log.error(f'Error stopping Firefox scope: {e}')

	def is_connected(self):
		with self._lock:
			try:
				self._ensure_connected(open_if_closed=False)
			except:
				pass
			return self._is_connected

	def get_window_dimensions(self):
		with self._lock:
			self._ensure_connected()
			window_rect = self.window_rect
			return {
				'width': window_rect.get('width') if isinstance(window_rect, dict) else None,
				'height': window_rect.get('height') if isinstance(window_rect, dict) else None,
				'x': window_rect.get('x') if isinstance(window_rect, dict) else None,
				'y': window_rect.get('y') if isinstance(window_rect, dict) else None,
			}

	def get_user_agent(self):
		with self._lock:
			self._ensure_connected()
			user_agent = super().get_pref('general.useragent.override')
			return user_agent if user_agent else 'default'

	def reset_browser(self):
		with self._lock:
			self._ensure_connected()
			log.info('Resetting browser')
			super().delete_all_cookies()
			super().clear_pref('general.useragent.override')
			super().maximize_window()
			return self

	def shuffle_browser(self):
		with self._lock:
			self._ensure_connected()
			log.info('Shuffling browser situation')
			super().delete_all_cookies()

			if random.randint(1, 5) == 3:
				super().maximize_window()
			else:
				super().set_window_rect(
					width=random.randint(800, 1920),
					height=random.randint(600, 1080),
				)

			user_agent = random.choice(alt_user_agents)
			if user_agent is None:
				super().clear_pref('general.useragent.override')
			else:
				super().set_pref('general.useragent.override', user_agent)
			return self

	def nagivate(self, url: str, *, force: bool = False, strip_slash: bool = True):
		with self._lock:
			self._ensure_connected()
			curr_url = str(super().get_url())
			curr_url = (curr_url.strip('/') if strip_slash else curr_url).strip()
			new_url = (url.strip('/') if strip_slash else url).strip()

			log.info('Starting navigation', extra={
				'force': force,
				'curr_url': curr_url,
				'new_url': new_url,
			})

			if not force and curr_url.startswith(new_url):
				log.info('Skipping navigation')
				return self

			log.info('Doing navigation change')
			super().navigate(new_url)
			return self

	def navigate(self, url: str, *, force: bool = False, strip_slash: bool = True):
		return self.nagivate(url, force=force, strip_slash=strip_slash)

	def go_back(self):
		with self._lock:
			self._ensure_connected()
			log.info('Navigation back')
			super().go_back()
			return self

	def type_string(self, element: WebElement, string: str):
		with self._lock:
			self._ensure_connected()
			for char in string:
				element.send_keys(char)
				utils.randsleep()
			return self

	def submit_text_input(self, element: WebElement, text: str):
		with self._lock:
			self._ensure_connected()
			element.clear()
			for char in text:
				element.send_keys(char)
				utils.randsleep()
			element.send_keys(Keys.ENTER)
			return self

	def url_matches_substr(self, substr: str) -> bool:
		with self._lock:
			self._ensure_connected()
			return substr in str(super().get_url()).lower()

	def wait_url_substr(self, url_substr: str, timeout: int = 30):
		with self._lock:
			self._ensure_connected()
			log.info('Waiting for URL to contain substr', extra={
				'url_substr': url_substr,
			})

			start = time.time()
			while time.time() - start < timeout:
				if url_substr in str(super().get_url()).lower():
					log.info('URL substr found')
					return self
				time.sleep(0.1)

			raise TimeoutError(f'Timeout waiting for URL to contain substr "{url_substr}"')

	def wait_element(self, by: str, value: str, timeout: int = 30) -> WebElement:
		with self._lock:
			self._ensure_connected()
			elements = self._wait_elements_internal(by, value, timeout)
			return elements[0]

	def wait_elements(self, by: str, value: str, timeout: int = 30):
		with self._lock:
			self._ensure_connected()
			return self._wait_elements_internal(by, value, timeout)

	def _wait_elements_internal(self, by: str, value: str, timeout: int = 30):
		log.info('Waiting for elements', extra={
			'by': by,
			'value': value,
		})

		start = time.time()
		while time.time() - start < timeout:
			try:
				elements = super().find_elements(by, value)
				if not isinstance(elements, (list, tuple)):
					raise Exception('Invalid elements return type')

				if len(elements) == 0:
					raise Exception('No elements found')

				log.info(f'{len(elements)} Elements found')
				return elements
			except:
				time.sleep(0.1)

		raise TimeoutError(f'Timeout waiting for elements: "{by}"="{value}"')

	def delete_all_cookies(self):
		with self._lock:
			self._ensure_connected()
			log.info('Deleting all cookies')
			super().delete_all_cookies()
			return self

	def set_pref(self, pref: str, value: str, default_branch=False):
		with self._lock:
			self._ensure_connected()
			log.info('Setting pref', extra={
				'pref': pref,
				'value': value,
			})
			super().set_pref(pref, value, default_branch)
			return self

	def clear_pref(self, pref: str):
		with self._lock:
			self._ensure_connected()
			log.info('Clearing pref', extra={
				'pref': pref,
			})
			super().clear_pref(pref)
			return self

	def set_window_rect(self, x=None, y=None, height=None, width=None):
		with self._lock:
			self._ensure_connected()
			log.info('Setting window rect', extra={
				'x': x,
				'y': y,
				'height': height,
				'width': width,
			})
			super().set_window_rect(x, y, height, width)
			return self

	def fullscreen(self):
		with self._lock:
			self._ensure_connected()
			log.info('Fullscreen')
			super().fullscreen()
			return self

	def delete_session(self, send_request=True):
		with self._lock:
			log.info('Disconnecting...')
			super().delete_session(send_request)
			self._is_connected = False
			log.info('Marionette connection closed')
			return self

	def get_page_source(self):
		with self._lock:
			self._ensure_connected()
			return self.page_source

	# pylint: disable=redefined-builtin
	def find_elements(self, method, target, id=None):
		with self._lock:
			self._ensure_connected()
			return super().find_elements(method, target, id)

	def get_url(self):
		with self._lock:
			self._ensure_connected()
			return super().get_url()


firefox = FirefoxClient.get_instance()

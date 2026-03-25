from typing import Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def get(url: str, *, params: Optional[dict[str, str]] = None, timeout: int = 5, retries: int = 2):
	headers = {
		'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/117.0',
		'Accept-Language': 'en',
	}

	session = requests.Session()
	retry_strategy = Retry(
		total=retries,
		backoff_factor=1,  # Wait 1s, 2s, 4s between retries
		status_forcelist=[429, 500, 502, 503, 504],  # Retry on these status codes
	)
	adapter = HTTPAdapter(max_retries=retry_strategy)
	session.mount('http://', adapter)
	session.mount('https://', adapter)

	res = session.get(
		url,
		params=params,
		headers=headers,
		timeout=timeout,
	)
	res.raise_for_status()
	return res.text

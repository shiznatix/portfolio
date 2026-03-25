from typing import Literal, Optional

import rhpy
from rhpy.web import HTTPContext, RouteDecorators
import scrapers

router = RouteDecorators()

class ScrapeSchema(rhpy.Model):
	url: str
	params: dict[str, str] = {}
	tool: Optional[Literal['simple', 'firefox']] = 'simple'

class ImdbFindSchema(rhpy.Model):
	name: str
	kind: Literal['movie', 'show']

class ImdbScrapeSchema(rhpy.Model):
	imdb_id: str
	kind: Literal['movie', 'show']


@router.post('/scrape', body=ScrapeSchema)
def scrape(body: ScrapeSchema):
	if body.tool == 'firefox':
		page = scrapers.firefox.navigate(body.url).get_page_source()
	else:
		page = scrapers.get_simple(body.url, params=body.params)

	return {'page': page}

@router.post('/imdb/find', body=ImdbFindSchema)
def imdb_find(body: ImdbFindSchema):
	return scrapers.imdb_find(body.name, body.kind)

@router.post('/imdb/scrape', body=ImdbScrapeSchema)
def imdb_scrape(body: ImdbScrapeSchema):
	return scrapers.imdb_scrape(body.imdb_id, body.kind)


@router.post('/firefox/open')
def firefox_open():
	scrapers.firefox.open()
	return True

@router.post('/firefox/close')
def firefox_close():
	scrapers.firefox.close()
	return True

@router.get('/firefox/status')
def firefox_status(ctx: HTTPContext):
	with scrapers.firefox.get_lock():
		if not scrapers.firefox.is_connected():
			return {'connected': False}

		try:
			url = str(scrapers.firefox.get_url())
			window_dimensions = scrapers.firefox.get_window_dimensions()
			user_agent = scrapers.firefox.get_user_agent()

			return {
				'connected': True,
				'url': url,
				'window_size': window_dimensions,
				'user_agent': user_agent,
			}
		except Exception as e:
			ctx.log.warning(f'Error getting Firefox status: {e}')
			return {
				'connected': False,
				'error': str(e),
			}

@router.post('/firefox/reset')
def firefox_reset():
	scrapers.firefox.reset_browser()
	return True,

@router.post('/firefox/shuffle')
def firefox_shiffle():
	scrapers.firefox.shuffle_browser()
	return True

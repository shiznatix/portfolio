from datetime import datetime
from typing import Literal, Optional

from pyquery import PyQuery

import rhpy
from . import simple

log = rhpy.logs('imdb')

def find(name: str, kind: Literal['movie', 'show']):
	log_extra = { 'search_name': name, 'media_kind': kind }
	log.info('Searching for IMDB ID', extra=log_extra)
	dom = PyQuery(simple.get('https://www.imdb.com/find', params={
		'q': name,
		'exact': 'true',
		's': 'tt', # search titles
		'ttype': 'ft' if kind == 'movie' else 'tv',
	}))
	href = dom('li.ipc-metadata-list-summary-item a.ipc-lockup-overlay').attr('href')
	imdb_id = None
	if isinstance(href, str):
		imdb_id = href.split('/')[2].strip()

	if not imdb_id:
		raise LookupError(f'Could not find IMDB ID for {kind} "{name}"')
	log.info(f'Found IMDB ID {imdb_id}', extra=log_extra)
	return { 'imdb_id': imdb_id }

def scrape(imdb_id: str, kind: Literal['movie', 'show']):
	log_extra = { 'imdb_id': imdb_id, 'media_kind': kind }
	log.info('Scraping IMDB ID', extra=log_extra)
	dom = PyQuery(simple.get(f'https://www.imdb.com/title/{imdb_id}/'))
	res = {}

	res['name'] = str(dom('[data-testid="hero__primary-text"]').text()).strip()
	if not res['name']:
		raise LookupError(f'Could not find name from IMDB page for ID {imdb_id}')

	rating = str(dom('[data-testid="hero-rating-bar__aggregate-rating__score"] span').text()).split('/', maxsplit=1)[0].strip() or None
	res['rating'] = float(rating) if rating else None
	res['plot'] = str(dom('[data-testid="plot-xl"]').text()).strip() or None

	release_years = str(dom(f'a[href^="/title/{imdb_id}/releaseinfo/"].ipc-link').text()).strip() or None
	if release_years:
		release_years = release_years.split('–')
		year_released = release_years[0].strip() or None
		res['year_released'] = int(year_released) if year_released else None
		if len(release_years) > 1 and kind == 'show':
			year_ended = release_years[1].strip() or None
			res['year_ended'] = int(year_ended) if year_ended else None

	res['genres'] = []
	for item in dom('[data-testid="interests"] .ipc-chip__text').items():
		res['genres'].append(str(item.text()).strip())

	if kind == 'show':
		res['seasons'] = _EpisodesExtractor(imdb_id, res['name']).extract()

	log.info('Scraped IMDB ID', extra=log_extra)
	return res

class _EpisodesExtractor:
	def __init__(self, imdb_id: str, show_name: Optional[str]):
		self.imdb_id = imdb_id
		self.show_name = show_name
		self.log_extra = { 'show': show_name, 'imdb_id': imdb_id }
		self.seasons = {}

	def extract(self):
		dom = PyQuery(simple.get(f'https://www.imdb.com/title/{self.imdb_id}/episodes/'))
		self.extract_episodes('1', dom)

		for item in dom('[data-testid="tab-season-entry"]').items():
			rhpy.wait(1) # api backoff
			if not rhpy.running():
				raise InterruptedError('Quit event set, aborting IMDb season extraction')

			number = str(item.text()).strip()
			if not number:
				log.warning('Season number not found', extra=self.log_extra)
				continue
			elif not number.isdigit():
				log.warning(f'Season number not digit: {number}', extra=self.log_extra)
				continue
			elif number in self.seasons:
				log.info(f'Season number {number} already extracted, skipping', extra=self.log_extra)
				continue

			path = str(item('a').attr('href')).strip().lstrip('/')
			if not path:
				log.warning('Season link path not found', extra=self.log_extra)
				continue

			self.extract_episodes(number, PyQuery(simple.get(f'https://www.imdb.com/{path}')))

		return self.seasons

	def extract_episodes(self, season_number: str, dom: PyQuery):
		log_extra = { **self.log_extra, 'season_number': season_number }
		episodes = {}
		i = 0
		for item in dom('.episode-item-wrapper').items():
			i += 1

			title_text = str(item('.ipc-title__text').text()).strip()
			if not title_text:
				log.warning(f'Episode title text not found i:{i}', extra=log_extra)
				continue

			title_parts = title_text.split('∙', 1)
			if len(title_parts) < 2:
				log.warning(f'Episode title parts len less than 2 i:{i}', extra={ **log_extra, 'title_text': title_text })
				continue

			number = title_parts[0].strip().split('E')[-1]
			if not number or not number.isdigit():
				log.warning(f'Episode number not found i:{i}', extra=log_extra)
				continue

			name = title_parts[1].strip()
			if not name:
				log.warning(f'Episode name not found i:{i}', extra=log_extra)
				continue
			elif name.lower().startswith('episode #'):
				log.info(f'Skipping placeholder episode i:{i}', extra=log_extra)
				continue

			air_date_text = str(item('[data-testid="slate-list-card-title"]').siblings('span').text()).strip()
			air_date = None
			if air_date_text:
				if air_date_text.isdigit() and len(air_date_text) == 4:
					air_date = f'{air_date_text}-01-01'
				else:
					try:
						air_date = datetime.strptime(air_date_text, '%a, %b %d, %Y').strftime('%Y-%m-%d')
					except ValueError:
						log.info(f'Could not parse air_date i:{i}', extra={**log_extra, 'air_date': air_date_text})

			episodes[number] = { 'name': name, 'air_date': air_date }

		log.info(f'Extracted season {season_number} with {len(episodes)} episodes', extra=log_extra)
		if episodes:
			self.seasons[season_number] = episodes

# Web Scraper

A REST API service for web scraping that supports both simple HTTP requests and full browser automation via Firefox, with a specialized IMDB extractor built on top.

## Challenges

Finding documentation on the Marionette python library proved difficult. The hardest was bypassing "bot protection" services. The browser and cookies needed to be "warmed up" and I had to pay special attention that I was not getting my IP marked as being a bot farm of some kind.

## Simple scraper

Plain HTTP requests with a Firefox user-agent header and exponential backoff retry logic for transient errors (429, 5xx). Fast and sufficient for static HTML.

## Firefox scraper

Controls a live Firefox instance via the [Marionette](https://firefox-source-docs.mozilla.org/testing/marionette/) protocol for JavaScript-heavy or bot-protected pages. Implemented as a thread-safe singleton with:
- Random user-agent rotation across 8 Firefox variants (Windows, macOS, Linux)
- Window dimension randomization on each session
- Cookie clearing between requests
- Smart navigation that skips reloads when already on the target URL
- Firefox process managed via systemd scopes for clean lifecycle control
- A Tampermonkey script to mask `navigator.webdriver`

## IMDB scraper

Built on the Firefox strategy. Given a title and media type, it finds the IMDB ID, then scrapes the title page for metadata (rating, plot, genres, years) and recursively extracts all seasons and episodes with air dates, including API throttling and graceful handling of missing data.

## Tech Stack

- **Python** — utilizing the internal framework `rhpy` from the project `redhouse-platform` included in this portfolio
- **marionette-driver** — Firefox remote protocol client
- **pyquery** — jQuery-style CSS selector for HTML parsing

import { arrayMove, arrayUnique, removeByValue } from './functions';
import { BrowseSortBy, EpisodesHideShowProfile, EpisodesMutators, RandomPreset } from './types';

const ITEM_RANDOM_PRESETS = 'randomPresets';
const ITEM_LAST_USED_RANDOM_PRESET = 'lastUsedRandomPreset';
const ITEM_LAST_FS_EPISODES_MUTATORS = 'lastFsEpisodesMutators';
const ITEM_LAST_FS_EPISODES_HIDDEN_SHOWS_PROFILES = 'lastFsEpisodesHideShowProfiles';
const ITEM_LAST_BROWSE_SORT_BY = 'lastBrowseSortBy';
const ITEM_LAST_BROWSE_PATH = 'lastBrowsePath';
const ITEM_BOOKMARKS = 'bookmarks';

function getSingleValue(key: string) {
	return window.localStorage.getItem(key) || null;
}

// random presets
export function getRandomPresets(): RandomPreset[] {
	const rawVal = getSingleValue(ITEM_RANDOM_PRESETS);
	const check1 = rawVal ? (JSON.parse(rawVal) as RandomPreset[]) : [];
	const check2 = check1 && Array.isArray(check1) ? check1 : [];

	return check2.filter(p => p && p.id && p.name && typeof p.count === 'number' && Array.isArray(p.slots))
		.map(p => ({
			...p,
			slots: p.slots.filter(s => s.id && Array.isArray(s.shows))
				.map(s => ({
					...s,
					shows: s.shows.filter(s => typeof s === 'string' && s.trim())
						.map(s => s.trim()),
				})),
		}));
}

export function reorderRandomPresets(fromIndex: number, toIndex: number): void {
	const presets = getRandomPresets();

	arrayMove(presets, fromIndex, toIndex, true);
	window.localStorage.setItem(ITEM_RANDOM_PRESETS, JSON.stringify(presets));
}

export function saveRandomPreset(preset: RandomPreset): number {
	const presets = getRandomPresets();
	const i = presets.findIndex(p => p.id === preset.id);

	if (i > -1) {
		presets[i] = preset;
	} else {
		presets.push(preset);
	}

	window.localStorage.setItem(ITEM_RANDOM_PRESETS, JSON.stringify(presets));

	return presets.length;
}

export function deleteRandomPreset(preset: RandomPreset): number {
	const presets = getRandomPresets();
	const i = presets.findIndex(p => p.id === preset.id);

	if (i > -1) {
		presets.splice(i, 1);
	}

	window.localStorage.setItem(ITEM_RANDOM_PRESETS, JSON.stringify(presets));

	return presets.length;
}

// last used preset
export function getLastUsedRandomPresetId(): string {
	return getSingleValue(ITEM_LAST_USED_RANDOM_PRESET) || '';
}

export function saveLastUsedRandomPresetId(id: string): void {
	window.localStorage.setItem(ITEM_LAST_USED_RANDOM_PRESET, id);
}

// browse sort by
export function getLastBrowseSortBy(): BrowseSortBy {
	return (getSingleValue(ITEM_LAST_BROWSE_SORT_BY) as BrowseSortBy) || 'name';
}

export function saveLastBrowseSortBy(sortBy: BrowseSortBy): void {
	window.localStorage.setItem(ITEM_LAST_BROWSE_SORT_BY, sortBy);
}

// browse path
export function getLastBrowsePath(): string {
	return getSingleValue(ITEM_LAST_BROWSE_PATH) || '/';
}

export function saveLastBrowsePath(path: string): void {
	window.localStorage.setItem(ITEM_LAST_BROWSE_PATH, path);
}

// fsEpisodes mutators
export function getLastFsEpisodesMutators(): Omit<EpisodesMutators, 'search' | 'hiddenShowNames'> {
	const str = getSingleValue(ITEM_LAST_FS_EPISODES_MUTATORS);
	const val = str ? JSON.parse(str) : {};

	return {
		seen: val.seen || 'both',
		autoDownloaded: val.autoDownloaded || 'both',
		includeInRandom: val.includeInRandom || 'both',
		starred: val.starred || 'both',
		episodeSortDirection: val.episodeSortDirection || 'asc',
		episodeSortBy: val.episodeSortBy || 'name',
		hiddenShowsProfileName: val.hiddenShowsProfileName || null,
	};
}

export function saveLastFsEpisodesMutators(vals: Omit<EpisodesMutators, 'search' | 'hiddenShowNames'>): void {
	window.localStorage.setItem(ITEM_LAST_FS_EPISODES_MUTATORS, JSON.stringify(vals));
}

// fsEpisodes hiddenShowsProfiles
export function getFsEpisodesHiddenShowsProfiles(): EpisodesHideShowProfile[] {
	const str = getSingleValue(ITEM_LAST_FS_EPISODES_HIDDEN_SHOWS_PROFILES);
	const vals = str ? JSON.parse(str) : [];

	return (Array.isArray(vals) ? vals : []).map(val => ({
		name: typeof val.name === 'string' ? val.name.trim() : null,
		showNames: (Array.isArray(val.showNames) ? val.showNames : []).filter((n: string) => n),
	})).filter(p => p.name);
}

export function saveFsEpisodesHiddenShowsProfiles(vals: EpisodesHideShowProfile[]): void {
	window.localStorage.setItem(ITEM_LAST_FS_EPISODES_HIDDEN_SHOWS_PROFILES, JSON.stringify(vals));
}


// bookmarks
export function getBookmarks(): string[] {
	const bookmarks = getSingleValue(ITEM_BOOKMARKS);

	return bookmarks ? JSON.parse(bookmarks) : [];
}

export function saveBookmarks(paths: string[]) {
	window.localStorage.setItem(ITEM_BOOKMARKS, JSON.stringify(arrayUnique(paths)));
}

export function addBookmark(path: string): void {
	saveBookmarks([
		...getBookmarks(),
		path,
	]);
}

export function deleteBookmark(path: string): void {
	saveBookmarks(removeByValue(getBookmarks(), path));
}

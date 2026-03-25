import { ApiError } from './api';

export type MuiColor = 'warning' | 'danger' | 'primary' | 'success' | 'neutral';
export type MuiVariant = 'solid' | 'outlined' | 'plain' | 'soft';
export type MuiSize = 'sm' | 'md' | 'lg';

export type ViewKey = 'browse' | 'random' | 'downloads' | 'status' | 'fsEpisodes';

export type RemoteButtonConfig = {
	label: string;
	subLabel?: string;
	icon: React.ReactElement;
};

export type VolumeControl = 'system' | 'vlc' | 'tv';

export type WidthLevel = 'xs' | 'sm' | 'md' | 'lg';

export type SortDirection = 'asc' | 'desc';

export type PlayProgress = {
	position: number;
	percent: number;
	duration: string | null;
	remaining: string | null;
	played: string | null;
	state: string | null;
};

export type EpisodesMutators = {
	seen: FilterGroupValue;
	autoDownloaded: FilterGroupValue;
	includeInRandom: FilterGroupValue;
	starred: FilterGroupValue;
	episodeSortDirection: SortDirection;
	episodeSortBy: ShowEpisodesSortBy;
	hiddenShowsProfileName: string | null;
	// not saved
	hiddenShowNames: string[];
	search: string;
};

export type EpisodesHideShowProfile = {
	name: string;
	showNames: string[];
};

export type BrowseSortBy = 'name' | 'newest';
export type BrowseFilter = 'seen' | 'auto-downloaded';
export type BrowseMutators = {
	xattr: BrowseFilter[];
	sortDirection: SortDirection;
	sortBy: BrowseSortBy;
	search: string;
};

export type ShowSortBy = 'showName' | 'seasonsCount' | 'episodesCount' | 'maxPlayedCount' | 'lastPlayedTime';
export type ShowEpisodesSortBy = 'episodeNumber' | 'episodeName' | 'playedCount' | 'lastPlayedTime';

export type FilterGroupValue = 'yes' | 'no' | 'both';

export type SetPlaylistMethod = 'replace' | 'append';

export type DownloadAction = 'start' | 'pause' | 'delete';

export type DatabaseSyncAction = 'sync' | 'pause' | 'resume';

export type ApiCmd = (cmd: string) => () => Promise<unknown>;

export type ErrorBoxContent = string | ApiError | Error | null;

export type RandomPresetSlot = {
	id: string;
	shows: string[];
};
export type RandomPreset = {
	id: string;
	name: string;
	count: number;
	slots: RandomPresetSlot[];
};

export interface ShowCategory {
	label: string;
	shows: string[];
}

export interface LabelsEntry {
	name: string;
	count: number;
}

export interface VlrFileAttrs {
	playedCount: number;
	lastPlayedTime: number | null;
	autoDownloaded: boolean;
	skipInRandom: boolean;
	starred: boolean;
	labels: string[];
}

export interface BrowseFile extends Partial<VlrFileAttrs> {
	discriminator: 'browseFile';
	fileName: string;
	filePath: string;
	isDir: boolean;
	playableExtension: boolean;
	modifiedTime: number;
}

export interface BrowsePathEntry {
	discriminator: 'path';
	files: BrowseFile[];
}

export interface BrowseLabelsEntry {
	discriminator: 'labels';
	labels: string[];
	files: BrowseFile[];
}

export type BrowseEntry = BrowsePathEntry | BrowseLabelsEntry;

export interface PlaylistItem {
	discriminator: 'playlistItem';
	vlcItem: {
		playing: boolean;
		fileName: string;
		filePath: string;
	};
	fsEpisode?: FsEpisode;
}

export interface SubtitleTrack {
	id: number;
	language: string;
}

export interface AudioTrack {
	id: number;
	language: string;
}

export interface TorrentLink {
	id: number;
	magnetLink: string;
	fileName: string;
	seeders: number;
	fileSize: string;
	transmissionId: string;
	active: boolean;
	logs: string[];
}

// TODO can i add a discriminator here and use `type` instead of `interface`?
export interface BaseEpisode {
	showName: string;
	episodeNumber: string;
	episodeName: string;
	seasonNumber?: string;
}

export interface FsEpisode extends BaseEpisode, VlrFileAttrs {
	discriminator: 'fsEpisode';
	id: number;
	fileName: string;
	filePath: string;
}

export interface ImdbEpisode extends BaseEpisode {
	discriminator: 'imdbEpisode';
	id: number;
	airTime: number;
}

export type MissingEpisodeListItem = ImdbEpisode & {
	ignore: boolean;
	torrents: TorrentLink[];
	logs: string[];
}

export interface MissingEpisode {
	id: number;
	lastSearchTime: number;
	ignore: boolean;
	torrents: TorrentLink[];
	logs: string[];
	imdbEpisode: ImdbEpisode;
}

// showName: { seasonNumber: Episode[] }
export type ShowEpisodes<T extends BaseEpisode> = Record<string, Record<string, T[]>>;

export interface TorrentDownload {
	id: string;
	donePercent: string;
	amountDownloaded: string;
	eta: string;
	uploadSpeed: string;
	downloadSpeed: string;
	shareRatio: string;
	status: string;
	simpleStatus: 'downloading' | 'paused';
	name: string;
}

export interface VlcStatus {
	state: string;
	position: number;
	fullscreen: boolean;
	audioTracks: AudioTrack[] | null;
	subtitleTracks: SubtitleTrack[] | null;
	subtitleDelay: number;
	meta: {
		fileName: string;
		duration: string;
	};
}

export interface TvStatus {
	connected: boolean;
	power: string;
};

export interface VlrStatus {
	vlc: VlcStatus | null;
	tv: TvStatus | null,
}

export type VlrLogs = Record<string, Record<string, string[]>>;

export interface ShowCategories {
	[key: string]: string[];
}

export interface SimpleResponse {
	data: boolean;
}

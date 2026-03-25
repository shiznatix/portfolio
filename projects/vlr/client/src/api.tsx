import {
	PlaylistItem,
	TorrentDownload,
	SimpleResponse,
	SetPlaylistMethod,
	DownloadAction,
	VlrStatus,
	MissingEpisode,
	FsEpisode,
	ShowCategories,
	ShowCategory,
	RandomPresetSlot,
	LabelsEntry,
	BrowsePathEntry,
	BrowseLabelsEntry,
	VlrLogs,
	VlrFileAttrs,
	DatabaseSyncAction,
} from './types';

export class ApiError extends Error {
	public statusCode: number;
	public path: string;
	public messages?: string[];

	constructor(message: string, statusCode: number, path: string, messages?: string[]) {
		super(message);
		this.statusCode = statusCode;
		this.path = path;
		this.messages = messages;
	}
}

type ApiErrorResponse = {
	fields?: Record<string, string>,
	error?: string,
};

async function fetchWithFail<T>(url: string, params?: RequestInit): Promise<T> {
	// TODO default timeout maybe????
	const res = await fetch(url, params);
	let body: string | {
		data: ApiErrorResponse | T,
	} = await res.text();

	try {
		body = JSON.parse(body as string);
	} catch (_) {
	}
	
	if (!res || !res.ok) {
		console.log('API ERROR: ', body);
		let errMessage = 'Unknown error';
		let errMessages: string[] | undefined;
		
		if (res.status === 404) {
			errMessage = 'Endpoint not found';
		} else if (typeof body === 'string') {
			errMessage = body;
		} else if (body && body.data) {
			const err = body.data as ApiErrorResponse;

			if (err.error) {
				errMessage = err.error;
			} else if (err.fields) {
				errMessage = 'Validation failed';
				errMessages = Object.values(err.fields);
			}
		}

		throw new ApiError(errMessage, res.status, url, errMessages);
	}

	// @ts-ignore
	return body.data as T;
}

function emptyPut<T>(uri: string) {
	return fetchWithFail<T>(uri, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
	});
}

function jsonBody<T>(uri: string, method: string, body: Record<string, unknown>) {
	return fetchWithFail<T>(uri, {
		method,
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
}

function withDiscriminator<T extends { discriminator: string }>(val: string, body: T[]) {
	const res: T[] = [];

	for (const item of body) {
		res.push({
			...item,
			discriminator: val,
		});
	}

	return res;
}

export async function playlist(): Promise<PlaylistItem[]> {
	return withDiscriminator('playlistItem', await fetchWithFail('/api/playlist'));
}

export function playlistCommand(command: string): Promise<SimpleResponse> {
	return emptyPut(`/api/playlist/${command}`);
}

export function playerCommand<T = SimpleResponse>(command: string): Promise<T> {
	return jsonBody('/api/player', 'PUT', {
		command,
	});
}

export function tvCommand(command: string): Promise<SimpleResponse> {
	return jsonBody('/api/tv', 'PUT', {
		command,
	});
}

export function systemCommand(command: string): Promise<SimpleResponse> {
	return jsonBody('/api/system', 'PUT', {
		command,
	});
}

export async function shows(): Promise<ShowCategory[]> {
	const body = await fetchWithFail<ShowCategories>('/api/shows');
	const categories: ShowCategory[] = [];

	for (const label in body) {
		categories.push({
			label,
			shows: body[label],
		});
	}

	categories.sort((a, b) => (a.label > b.label ? 1 : -1))

	return categories;
}

export async function random(
	amount: number,
	slots: RandomPresetSlot[],
	method = 'replace',
): Promise<FsEpisode[]> {
	return withDiscriminator('fsEpisode', await jsonBody<FsEpisode[]>('/api/random', 'POST', {
		slots,
		amount,
		method,
	}));
}

export async function browsePath(dir: string): Promise<BrowsePathEntry[]> {
	const res = withDiscriminator('path', await jsonBody<BrowsePathEntry[]>('/api/browse/path', 'POST', {
		dir,
	}));

	return res.map(entry => ({
		...entry,
		files: withDiscriminator('browseFile', entry.files),
	}));
}

export async function browseLabels(dir: string, labels: string[]): Promise<BrowseLabelsEntry[]> {
	const res = withDiscriminator('labels', await jsonBody<BrowseLabelsEntry[]>('/api/browse/labels', 'POST', {
		dir,
		labels,
	}));

	return res.map(entry => ({
		...entry,
		files: withDiscriminator('browseFile', entry.files),
	}));
}

export async function browseSeason(showName: string, seasonNum: string): Promise<BrowsePathEntry[]> {
	const res = withDiscriminator('path', await jsonBody<BrowsePathEntry[]>('/api/browse/season', 'POST', {
		showName,
		seasonNum,
	}));

	return res.map(entry => ({
		...entry,
		files: withDiscriminator('browseFile', entry.files),
	}));
}

export function labels(dir?: string): Promise<LabelsEntry[]> {
	return jsonBody('/api/labels', 'POST', {
		dir,
	});
}

export function setPlaylistPaths(paths: string[], method: SetPlaylistMethod): Promise<SimpleResponse> {
	return jsonBody('/api/playlist', 'POST', {
		paths,
		method,
	});
}

export function setPlaylistStreamUrls(streamUrls: string[], method: SetPlaylistMethod): Promise<SimpleResponse> {
	return jsonBody('/api/playlist', 'POST', {
		streamUrls,
		method,
	});
}

export function setXAttrValue(
	path: string,
	attr: keyof VlrFileAttrs,
	value: string,
): Promise<unknown> {
	return jsonBody('/api/files/set-xattr', 'POST', {
		path,
		attr,
		value,
	});
}

export function playAt(index: number): Promise<SimpleResponse> {
	return jsonBody('/api/playlist/play-at', 'PUT', {
		index,
	});
}

export function removeAt(index: number): Promise<SimpleResponse> {
	return jsonBody('/api/playlist/remove-at', 'DELETE', {
		index,
	});
}

export function setSubtitleTrack(id: number): Promise<SimpleResponse> {
	return jsonBody('/api/subtitles', 'PUT', {
		id,
	});
}

export function setSubtitleDelay(delay: number): Promise<SimpleResponse> {
	return jsonBody('/api/subtitles/delay', 'PUT', {
		delay,
	});
}

export function setAudioTrack(id: number): Promise<SimpleResponse> {
	return jsonBody('/api/audio', 'PUT', {
		id,
	});
}

export function status(): Promise<VlrStatus> {
	return fetchWithFail('/api/status');
}

export function logs(): Promise<VlrLogs> {
	return fetchWithFail('/api/logs');
}

export async function missingEpisodes(): Promise<MissingEpisode[]> {
	// not using `withDiscriminator` because the discriminator is in a nested prop
	const res = await fetchWithFail<MissingEpisode[]>('/api/missing-episodes');

	return res.map(mep => ({
		...mep,
		imdbEpisode: {
			...mep.imdbEpisode,
			discriminator: 'imdbEpisode',
		},
	}));
}

export function ignoreMissingEpisode(id: number, ignored: boolean): Promise<void> {
	return jsonBody('/api/missing-episodes/ignore', 'PUT', {
		id,
		ignored,
	});
}

export function downloads(): Promise<TorrentDownload[]> {
	return fetchWithFail('/api/downloads');
}

export async function fsEpisodes(): Promise<FsEpisode[]> {
	return withDiscriminator('fsEpisode', await fetchWithFail<FsEpisode[]>('/api/filesystem-episodes'));
}

export function downloadAction(id: string, action: DownloadAction): Promise<TorrentDownload[]> {
	return jsonBody('/api/downloads/action', 'POST', {
		id,
		action,
	});
}

export function selectTorrent({episodeId, torrentId } : { episodeId: number, torrentId: number}): Promise<void> {
	return jsonBody('/api/downloads/select', 'PUT', {
		episodeId,
		torrentId,
	});
}

export function syncDatabase(database: string, action: DatabaseSyncAction): Promise<void> {
	return jsonBody('/api/database-sync', 'POST', {
		database,
		action,
	});
}

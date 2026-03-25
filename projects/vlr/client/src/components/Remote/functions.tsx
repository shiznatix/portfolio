import { padZero } from '../../functions';
import { PlayProgress, VlcStatus } from '../../types';

function trimDuration(duration: string, dropHours = true) {
	const parts = duration.split('.').shift()?.split(':') || [];

	if (parts.length !== 3) {
		return duration;
	}

	const hours = padZero(parts[0]);
	const minutes = padZero(parts[1]);
	const seconds = padZero(parts[2]);

	if (dropHours && hours === '00') {
		return `${minutes}:${seconds}`;
	}

	return `${hours}:${minutes}:${seconds}`;
}

function secondsToDuration(seconds: number) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds - (hours * 3600)) / 60);
	const secs = Math.floor(seconds - (hours * 3600) - (minutes * 60));

	return trimDuration(`${hours}:${minutes}:${secs}`);
}

export function playProgress(vlcStatus: VlcStatus | null) {
	const position = vlcStatus?.position || 0;
	const percent = Math.round(position * 100);

	const progress: PlayProgress = {
		position,
		percent,
		duration: vlcStatus?.meta.duration ? trimDuration(vlcStatus.meta.duration) : null,
		remaining: null,
		played: null,
		state: vlcStatus?.state || null,
	};

	if (progress.duration) {
		const durationInSeconds = progress.duration.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
		const remainingInSeconds = (1 - position) * durationInSeconds;
		const playedInSeconds = durationInSeconds - remainingInSeconds;

		progress.remaining = secondsToDuration(remainingInSeconds);
		progress.played = secondsToDuration(playedInSeconds);
	}
	
	return progress;
}

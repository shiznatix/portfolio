import { CameraStreamType } from './types';

// TODO - globalize
export function arrayUnique<T>(a: T[]) {
	return a.filter((value, index, array) => array.indexOf(value) === index);
}

export function ucfirst(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export function padStartZero(num: number): string {
	const numStr = num.toString();

	if (num < 10) {
		return numStr.padStart(2, '0');
	}

	return numStr;
}

export function getDateTime(date?: Date) {
	date = date ?? new Date();
	return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

let _cachedIsMobile: boolean | null = null;
export function isMobile() {
	if (_cachedIsMobile === null) {
		_cachedIsMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
			|| ('ontouchstart' in window)
			|| (navigator.maxTouchPoints > 0);
	}

	return _cachedIsMobile;
}
// END TODO - globalize

export function getShortStreamType(streamType: CameraStreamType): string {
	switch (streamType) {
		case 'rtcpeer':
			return 'RTC';
		case 'mjpeg':
			return 'JPG';
	}
}

export function disablePicInPic() {
	return isMobile();
}

export function parseFileName(fileName: string, preserveFileName = false) {
	let extension = null;
	let episodeNumber = null;
	let name = fileName;

	const extIndex = name.lastIndexOf('.');

	if (extIndex > -1) {
		extension = name.substring(extIndex + 1);

		if (!preserveFileName) {
			name = name.substring(0, extIndex);
		}
	}

	const parts = name.split(/^([0-9]{2}(-[0-9]{2})?) - /).filter(p => p);

	if (parts.length > 1) {
		episodeNumber = parts[0];

		if (!preserveFileName) {
			name = name.replace(`${episodeNumber} - `, '').trim();
		}
	}

	return {
		extension,
		episodeNumber,
		name,
	};
}

export function parseFilePath(path: string, showDirs: string[]) {
	for (const dir of showDirs) {
		if (path.startsWith(dir)) {
			const parts = path.replace(dir, '').split('/').filter(p => p);

			if (parts.length === 0) {
				continue;
			}

			const showName = parts[0];

			if (parts.length === 1) {
				return {
					showName,
				};
			}

			const nextPartIsFile = /\.[a-z]{3,4}$/.test(parts[1]);

			if (nextPartIsFile) {
				return {
					showName,
					fileName: parts[1],
				};
			}

			const nextPartHasSeasonNumber = /^[Ss]{1}eason [0-9]{1,2}$/.test(parts[1]);
			const seasonNumber = nextPartHasSeasonNumber ? parts[1].toLowerCase().replace('season', '').trim() : parts[1];

			if (parts.length === 2) {
				return {
					showName,
					seasonNumber,
				};
			}

			return {
				showName,
				seasonNumber,
				fileName: parts[2],
			};
		}
	}

	return null;
}

export function stripPrefix(str: string, prefixes: string[]) {
	for (const prefix of prefixes) {
		if (str.startsWith(prefix)) {
			return str.replace(prefix, '').replace(/^\//, '');
		}
	}

	return str;
}

export function ucfirst(str: string) {
    return `${str.charAt(0).toUpperCase()}${str.slice(1)}`;
}

export function floatToPercent(val: number) {
	return `${Math.round(val * 100)}%`;
}

export function arraysEqual<T>(arr1: T[], arr2: T[]) {
	if (arr1.length === 0 && arr2.length === 0) {
		return true;
	}

	arr1 = [...arr1].sort();
	arr2 = [...arr2].sort();

	return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

export function arrayMove<T>(arr: T[], fromIndex: number, toIndex: number, inPlace = false) {
	const newArr = inPlace ? arr : structuredClone(arr);
	const val = newArr[fromIndex];

	newArr.splice(fromIndex, 1);
	newArr.splice(toIndex, 0, val);

	return newArr;
}

export function sortArrayByKey<T, V extends string | number>(arr: T[], key: keyof T, transformVal: (v: V) => V = (v: V) => v, inPlace = false) {
	const newArr = inPlace ? arr : structuredClone(arr);

	return newArr.sort((a, b) => {
		let x = transformVal(a[key] as V);
		let y = transformVal(b[key] as V);
		const xType = typeof x
		const yType = typeof y;
		const isStr = xType === 'string' && yType === 'string';
		
		if (isStr) {
			// @ts-ignore
			x = x.toLowerCase();
			// @ts-ignore
			y = y.toLowerCase();
		}
		
		return x > y ? 1 : (x < y ? -1 : 0);
	});
}

export function arrayUnique<T>(arr: T[]) {
	return arr.filter((value, index, array) => array.indexOf(value) === index);
}

export function removeByValue<T>(arr: T[], value: T) {
	const newArr: T[] = [];

	for (const v of arr) {
		if (v !== value) {
			newArr.push(v);
		}
	}

	return newArr;
}

export function updateByValue<T>(arr: T[], vals: Partial<T>, find: (v: T) => boolean, inPlace = false) {
	const newArr = inPlace ? arr : structuredClone(arr);

	for (let i = 0; i < newArr.length; i++) {
		const v = newArr[i];

		if (find(v)) {
			newArr[i] = {
				...newArr[i],
				...vals,
			};
		}
	}
	
	return newArr;
}

export function removeByKeyValue<T extends {}>(arr: T[], key: keyof T, value: unknown) {
	const newArr: T[] = [];

	for (const v of arr) {
		if (v[key] !== value) {
			newArr.push(v);
		}
	}

	return newArr;
}

export function removeOrAppend<T>(arr: T[], value: T) {
	const i = arr.findIndex(v => v === value);

	if (i > -1) {
		return removeByValue(arr, value);
	}
	
	return [
		...arr,
		value,
	];
}

export function padZero(val: number | string) {
	if (typeof val === 'number') {
		return val < 10 && val > -1 ? `0${val}` : `${val}`;
	}

	return val.length === 1 ? `0${val}` : val;
}

export function sortedObjectEntries<T>(obj: Record<string, T>, direction: 'asc' | 'desc' = 'asc', transformVal = (v: string) => v) {
	if (direction === 'desc') {
		return Object.entries(obj).sort((a, b) => transformVal(b[0]).localeCompare(transformVal(a[0])));
	}

	return Object.entries(obj).sort((a, b) => transformVal(a[0]).localeCompare(transformVal(b[0])));
}

export function timestampToStr(timestamp?: number | null): string {
	if (!timestamp) {
		return '';
	}

	const o = new Date(timestamp * 1000).getTime();
	const n = Date.now();
	const diff = n - o;

	if (diff < 0) {
		return 'N/A';
	}

	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const months = Math.floor(days / 30);
	const years = Math.floor(months / 12);

	if (years > 0) {
		return `${years}y`;
	} else if (months > 0) {
		return `${months}m`;
	} else if (days > 0) {
		return `${days}d`;
	} else if (hours > 0) {
		return `${hours}h`;
	} else if (minutes > 0) {
		return `${minutes}min`;
	}

	return 'now';
}

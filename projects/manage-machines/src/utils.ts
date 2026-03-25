export function arrayUnique<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
}

export function ucfirst(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export function lcfirst(str: string) {
	return str.charAt(0).toLowerCase() + str.slice(1);
}

export function camelToKebab(obj: string) {
	return obj.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function escapeSedReplacement(str: string) {
	return str.replace(/\\/g, '\\\\').replace(/\//g, '\\/').replace(/&/g, '\\&');
}

export function prettyJson(obj: unknown) {
	return JSON.stringify(obj, (_key, value) => {
		if (typeof value === 'symbol') {
			return String(value);
		}
		return value;
	}, 2);
}

export function sleep(ms: number) {
	return new Promise(r => setTimeout(r, ms));
}

export function getCallerName(...depths: number[]) {
	if (depths.length === 0) {
		depths = [3, 4];
	}

	const stack = new Error().stack;
	if (!stack) {
		return null;
	}

	const stackLines = stack.split('\n');
	const callerNames: string[] = [];
	for (const depth of depths) {
		if (stackLines.length <= depth) {
			continue;
		}

		const callerLine = stackLines[depth].trim();
		const fnMatch = callerLine.match(/at (\S+)/);
		const fn = fnMatch && fnMatch[1].split('.').pop();
		if (!fn) {
			continue;
		}

		// Extract file location (file.ts:line:col)
		const locationMatch = callerLine.match(/\(([^)]+)\)|at [^\s]+ (.+)$/);
		const location = locationMatch?.[1] || locationMatch?.[2];
		if (!location) {
			continue;
		}

		const parts = location.split(':');
		const filePath = parts[0];
		const fileName = filePath.split('/').pop();
		const lineNumber = parts[1];
		if (!fileName?.endsWith('.ts') || !lineNumber) {
			continue;
		}

		callerNames.push(`${fn}@${fileName}:${lineNumber}`);
	}

	return callerNames.length > 0 ? callerNames.join(' -> ') : null;
}

export function secsToRelativeTime(secs: number): string {
	return secs < 60
		? `${secs} seconds ago`
		: secs < 3600
			? `${Math.floor(secs / 60)} minutes ago`
			: secs < 86400
				? `${Math.floor(secs / 3600)} hours ago`
				: `${Math.floor(secs / 86400)} days ago`;
}

export function makeInstancePropMap(obj: Record<string, unknown>, excludeKeys: string[] = []) {
	return Object.entries(obj).reduce((acc, [key, value]) => {
		if (!excludeKeys.includes(key)) {
			acc[key] = {
				value,
				writable: true,
				enumerable: true,
				configurable: true,
			};
		}
		return acc;
	}, {} as PropertyDescriptorMap);
}

export function formatTimestamp(timestamp: string): string {
	return timestamp.slice(5, 19).replace('T', '_');
}

export function formatFileSize(bytes: number): string {
	return (bytes / (1024 * 1024)).toFixed(2);
}

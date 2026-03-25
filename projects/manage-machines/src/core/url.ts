export function buildUrl(
	ip: string,
	opts: {
		port?: number | string | null;
		path?: string;
		protocol?: string;
		username?: string;
		password?: string;
	} = {}
): string {
	const { port, path, protocol = 'http', username, password } = opts;

	// Basic auth URL
	if (username && password) {
		const portPart = port ? `:${port}` : '';
		const formattedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
		return `${protocol}://${username}:${password}@${ip}${portPart}${formattedPath}`;
	}

	// Standard URL
	const portPart = port ? `:${port}` : '';
	const formattedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
	return `${protocol}://${ip}${portPart}${formattedPath}`;
}

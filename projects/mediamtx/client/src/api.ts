// TODO - globalize
async function responseOk(res: Response) {
	if (!res.ok) {
		let errorMessage = `Request failed with ${res.status}`;
		try {
			const errorData = await res.json();
			if (typeof errorData.error === 'string') {
				errorMessage = errorData.error;
			}
		} catch {
			// Ignore JSON parse error
		}
		throw new Error(errorMessage);
	}
}

export async function get<T>(url: string): Promise<T> {
	const res = await fetch(url);
	await responseOk(res);
	return res.json() as Promise<T>;
}

export async function postCameraServo(
	url: string,
	data: { action: string; value?: number; direction?: string }
): Promise<void> {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	await responseOk(res);
}

export interface VoicesResponse {
	default: string;
	voices: Record<string, string>;
}
interface SynthesizeRequestBase {
	text: string;
	voice: string;
	lengthScale: number;
	noiseScale: number;
	noiseWScale: number;
	format?: 'ogg' | 'wav';
	signal?: AbortSignal;
}
export interface SynthesizeRequestUrl extends SynthesizeRequestBase {
	response: 'url';
}
export interface SynthesizeRequestFile extends SynthesizeRequestBase {
	response: 'file';
}
interface SynthesizeResponseBase {
	fileName: string;
	charCount: number;
	settings: {
		voice: string;
		lengthScale: number;
		noiseScale: number;
		noiseWScale: number;
	};
}
export interface SynthesizeResponseUrl extends SynthesizeResponseBase {
	url: string;
	fileSize: number;
}
export interface SynthesizeResponseFile extends SynthesizeResponseBase {
	blob: Blob;
}
export interface ExtractTextResponse {
	text: string;
}

function getApiUrl(path: string) {
	return window.CONFIG.apiUrl + path;
}

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

export async function fetchVoices(): Promise<VoicesResponse> {
	const res = await fetch(getApiUrl('/voices'));
	await responseOk(res);
	return res.json();
}

function getFilenameFromResponse(response: Response, fallbackName: string): string {
	const disposition = response.headers.get('Content-Disposition');
	if (disposition) {
		const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
		if (filenameMatch) {
			return filenameMatch[1];
		}
	}
	return fallbackName;
}

export async function synthesizeAudio(request: SynthesizeRequestUrl): Promise<SynthesizeResponseUrl>;
export async function synthesizeAudio(request: SynthesizeRequestFile): Promise<SynthesizeResponseFile>;
export async function synthesizeAudio(request: SynthesizeRequestUrl | SynthesizeRequestFile): Promise<SynthesizeResponseUrl | SynthesizeResponseFile> {
	const { text, voice, lengthScale, noiseScale, noiseWScale, format = 'ogg', response = 'url', signal } = request;
	const formData = new FormData();
	formData.append('text', text);
	if (voice) {
		formData.append('voice', voice);
	}
	formData.append('format', format);
	formData.append('response', response);
	formData.append('length_scale', lengthScale.toString());
	formData.append('noise_scale', noiseScale.toString());
	formData.append('noise_w_scale', noiseWScale.toString());

	const res = await fetch(getApiUrl('/synthesize'), {
		method: 'POST',
		body: formData,
		signal,
	});
	await responseOk(res);

	if (response === 'url') {
		const body = await res.json();
		const { downloadPath, fileName, fileSize, charCount, ...settings } = body;
		return {
			url: getApiUrl(downloadPath),
			fileName,
			fileSize,
			charCount,
			settings,
		};
	}

	const resultHeader = res.headers.get('x-piper-voice-result');
	if (!resultHeader) {
		throw new Error('Missing result header');
	}

	const { fileName, charCount, ...settings } = JSON.parse(resultHeader);
	const blob = await res.blob();
	return {
		blob,
		fileName: getFilenameFromResponse(res, fileName),
		charCount,
		settings,
	};
}

export async function extractTextFromFile(file: File, signal?: AbortSignal): Promise<ExtractTextResponse> {
	const formData = new FormData();
	formData.append('contents', file);

	const res = await fetch(getApiUrl('/extract-text'), {
		method: 'POST',
		body: formData,
		signal,
	});
	await responseOk(res);

	const text = await res.text();
	return { text };
}

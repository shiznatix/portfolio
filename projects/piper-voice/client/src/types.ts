export interface VoiceSettings {
	voice: string;
	lengthScale: number;
	noiseScale: number;
	noiseWScale: number;
}

export interface HistoryEntry {
	text: string;
	url: string | null;
	fileName: string;
	fileSize: number;
	charCount: number;
	settings: VoiceSettings;
	timestamp: string;
}

export interface Voices {
	default: string;
	voices: Record<string, string>;
}

export type SynthesisSettings = VoiceSettings;

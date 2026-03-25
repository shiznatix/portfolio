import { createContext, useContext } from 'react';

import type { SynthesizeRequestUrl } from '../api';
import { synthesizeAudio } from '../api';
import { useLocalStorage } from '../hooks/use-local-storage';
import type { HistoryEntry, VoiceSettings } from '../types';

const MAX_HISTORY_ITEMS = 5;

interface HistoryContextValue {
	history: Record<string, HistoryEntry>;
	addHistoryEntry: (entry: HistoryEntry) => void;
	deleteHistoryEntry: (textKey: string) => void;
	clearHistory: () => void;
	synthesizeEntry: (text: string, settings: VoiceSettings, signal?: AbortSignal) => Promise<void>;
	resynthesizeEntry: (fileName: string) => Promise<string>;
	clearEntryUrl: (fileName: string) => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

interface HistoryProviderProps {
	children: React.ReactNode;
}

const HistoryProvider: React.FC<HistoryProviderProps> = ({ children }) => {
	const [history, setHistory] = useLocalStorage<Record<string, HistoryEntry>>('piper-voice-history', {});

	const addHistoryEntry = (entry: HistoryEntry) => {
		setHistory(prev => {
			const newHistory = { ...prev, [entry.fileName]: entry };
			const keys = Object.keys(newHistory);
			if (keys.length > MAX_HISTORY_ITEMS) {
				const lastFiveKeys = keys.slice(-MAX_HISTORY_ITEMS);
				const trimmedHistory: Record<string, HistoryEntry> = {};
				lastFiveKeys.forEach(key => {
					trimmedHistory[key] = newHistory[key];
				});
				return trimmedHistory;
			}
			return newHistory;
		});
	};

	const deleteHistoryEntry = (textKey: string) => {
		setHistory(prev => {
			const newHistory = { ...prev };
			delete newHistory[textKey];
			return newHistory;
		});
	};

	const clearHistory = () => setHistory({});

	const buildSynthesizeRequest = (text: string, settings: VoiceSettings, signal?: AbortSignal): SynthesizeRequestUrl => ({
		text,
		voice: settings.voice,
		lengthScale: settings.lengthScale,
		noiseScale: settings.noiseScale,
		noiseWScale: settings.noiseWScale,
		response: 'url',
		format: 'ogg',
		signal,
	});

	const updateEntryUrl = (fileName: string, url: string | null) => {
		setHistory(prev => {
			if (!prev[fileName]) {
				return prev;
			}
			return { ...prev, [fileName]: { ...prev[fileName], url } };
		});
	};

	const clearEntryUrl = (fileName: string) => updateEntryUrl(fileName, null);

	const synthesizeEntry = async (text: string, settings: VoiceSettings, signal?: AbortSignal): Promise<void> => {
		const result = await synthesizeAudio(buildSynthesizeRequest(text, settings, signal));
		const entry: HistoryEntry = {
			text,
			url: result.url,
			fileName: result.fileName,
			fileSize: result.fileSize,
			charCount: result.charCount,
			settings: result.settings,
			timestamp: new Date().toISOString(),
		};
		addHistoryEntry(entry);
	};

	const resynthesizeEntry = async (fileName: string): Promise<string> => {
		const entry = history[fileName];
		if (!entry) {
			throw new Error('Entry not found');
		}
		const result = await synthesizeAudio(buildSynthesizeRequest(entry.text, entry.settings));
		updateEntryUrl(fileName, result.url);
		return result.url;
	};

	return (
		<HistoryContext.Provider value={{
			history,
			addHistoryEntry,
			deleteHistoryEntry,
			clearHistory,
			synthesizeEntry,
			resynthesizeEntry,
			clearEntryUrl,
		}}>
			{children}
		</HistoryContext.Provider>
	);
};

const useHistory = () => {
	const context = useContext(HistoryContext);
	if (!context) {
		throw new Error('useHistory must be used within a HistoryProvider');
	}
	return context;
};

export { HistoryProvider, useHistory };

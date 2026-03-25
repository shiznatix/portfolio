import { useState } from 'react';

import type { HistoryEntry } from '../types';

function isValidHistoryEntry(entry: unknown): entry is HistoryEntry {
	return (
		typeof entry === 'object' &&
		entry !== null &&
		typeof (entry as HistoryEntry).text === 'string' &&
		typeof (entry as HistoryEntry).fileName === 'string' &&
		typeof (entry as HistoryEntry).timestamp === 'string' &&
		typeof (entry as HistoryEntry).settings === 'object' &&
		(entry as HistoryEntry).settings !== null
	);
}

function validateHistoryData(data: unknown): Record<string, HistoryEntry> {
	if (typeof data !== 'object' || data === null) {
		return {};
	}

	const validHistory: Record<string, HistoryEntry> = {};
	for (const [key, entry] of Object.entries(data)) {
		if (isValidHistoryEntry(entry)) {
			validHistory[key] = entry;
		} else {
			console.warn(`Skipping corrupted history entry: ${key}`);
		}
	}
	return validHistory;
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
	const [storedValue, setStoredValue] = useState<T>(() => {
		try {
			const item = window.localStorage.getItem(key);
			if (!item) {
				return initialValue;
			}

			const parsed = JSON.parse(item);

			// Special handling for history data
			if (key === 'piper-voice-history') {
				return validateHistoryData(parsed) as T;
			}

			return parsed;
		} catch (error) {
			console.error(`Failed to load from localStorage (${key}):`, error);
			// Clear corrupted data
			try {
				window.localStorage.removeItem(key);
			} catch {
				// Ignore
			}
			return initialValue;
		}
	});

	const setValue = (value: T | ((prev: T) => T)) => {
		try {
			const valueToStore = value instanceof Function ? value(storedValue) : value;
			setStoredValue(valueToStore);
			window.localStorage.setItem(key, JSON.stringify(valueToStore));
		} catch (error) {
			console.error('Failed to save to localStorage:', error);
		}
	};

	return [storedValue, setValue];
}

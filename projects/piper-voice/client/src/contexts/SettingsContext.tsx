import { createContext, ReactNode,useContext } from 'react';

import { useLocalStorage } from '../hooks/use-local-storage';
import type { SynthesisSettings } from '../types';

interface SettingsContextType {
	settings: SynthesisSettings;
	setSettings: (settings: SynthesisSettings) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [settings, setSettings] = useLocalStorage<SynthesisSettings>('piper-voice-settings', {
		voice: '',
		lengthScale: 1,
		noiseScale: 0,
		noiseWScale: 0,
	});

	return (
		<SettingsContext.Provider value={{ settings, setSettings }}>
			{children}
		</SettingsContext.Provider>
	);
};

export function useSettings() {
	const context = useContext(SettingsContext);
	if (context === null) {
		throw new Error('useSettings must be used within a SettingsProvider');
	}
	return context;
}

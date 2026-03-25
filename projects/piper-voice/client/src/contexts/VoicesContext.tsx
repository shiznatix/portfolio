import { createContext, useContext, useEffect, useState } from 'react';

import { fetchVoices } from '../api';
import type { Voices } from '../types';
import { useSettings } from './SettingsContext';

interface VoicesContextType {
	voices: Voices | null;
	voicesLoading: boolean;
}

const VoicesContext = createContext<VoicesContextType | null>(null);

export const VoicesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [voices, setVoices] = useState<Voices | null>(null);
	const [voicesLoading, setVoicesLoading] = useState(true);
	const { settings, setSettings } = useSettings();

	useEffect(() => {
		const loadVoices = async () => {
			try {
				const voicesData = await fetchVoices();
				setVoices(voicesData);
				if (!settings.voice && voicesData.voices) {
					const defaultVoiceKey = voicesData.default;
					setSettings({ ...settings, voice: voicesData.voices[defaultVoiceKey] });
				}
			} catch (error) {
				console.error('Failed to load voices:', error);
			} finally {
				setVoicesLoading(false);
			}
		};

		loadVoices();
	}, []);

	return (
		<VoicesContext.Provider value={{ voices, voicesLoading }}>
			{children}
		</VoicesContext.Provider>
	);
};

export const useVoices = (): VoicesContextType => {
	const context = useContext(VoicesContext);
	if (!context) throw new Error('useVoices must be used within a VoicesProvider');
	return context;
};

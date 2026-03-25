import { createContext, ReactNode, useContext, useState } from 'react';

interface AutoPlayContextType {
	autoPlay: boolean;
	setAutoPlay: (value: boolean) => void;
}

const AutoPlayContext = createContext<AutoPlayContextType | null>(null);

export const AutoPlayProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [autoPlay, setAutoPlay] = useState(false);

	return (
		<AutoPlayContext.Provider value={{ autoPlay, setAutoPlay }}>
			{children}
		</AutoPlayContext.Provider>
	);
};

export function useAutoPlay() {
	const context = useContext(AutoPlayContext);
	if (context === null) {
		throw new Error('useAutoPlay must be used within an AutoPlayProvider');
	}
	return context;
}

import { createContext, ReactNode, useState } from 'react';

interface ErrorContextType {
	error: string | null;
	setError: (error: string | null) => void;
	clearError: () => void;
}

export const ErrorContext = createContext<ErrorContextType | null>(null);

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [error, setError] = useState<string | null>(null);

	const clearError = () => setError(null);

	return (
		<ErrorContext.Provider value={{ error, setError, clearError }}>
			{children}
		</ErrorContext.Provider>
	);
};

import { createContext, useContext, useState } from 'react';

interface FormInputContextType {
	text: string;
	setText: (text: string) => void;
	file: File | null;
	setFile: (file: File | null) => void;
	inputType: 'text' | 'file';
	setInputType: (type: 'text' | 'file') => void;
}

const FormInputContext = createContext<FormInputContextType | null>(null);

export const FormInputProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [text, setText] = useState('Hello world! This is just a test.');
	const [file, setFile] = useState<File | null>(null);
	const [inputType, setInputType] = useState<'text' | 'file'>('text');

	return (
		<FormInputContext.Provider value={{ text, setText, file, setFile, inputType, setInputType }}>
			{children}
		</FormInputContext.Provider>
	);
};

export const useFormInput = (): FormInputContextType => {
	const context = useContext(FormInputContext);
	if (!context) throw new Error('useFormInput must be used within a FormInputProvider');
	return context;
};

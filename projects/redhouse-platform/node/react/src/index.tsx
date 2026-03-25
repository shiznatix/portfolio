import React from 'react';
import ReactDOM from 'react-dom/client';

export * from './ConfirmButton';
export * from './FlexChip';
export * from './Loadable';
export * from './ThemedApp';

export const createRoot = (app: React.ReactNode) => {
	ReactDOM.createRoot(document.getElementById('root')!).render(
		<React.StrictMode>
			{app}
		</React.StrictMode>
	);
};

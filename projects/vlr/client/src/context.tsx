import React from 'react';
import { extendTheme } from '@mui/joy';
import themes from './themes/themes';
import { config } from './config';

export const theme = extendTheme({
	colorSchemes: {
		light: {
			palette: config.themeName && themes[config.themeName] ? themes[config.themeName] : {},
		},
	},
});

export type ApiCtx = (setLoadingOrFunc: ((l: boolean) => void) | (() => Promise<void>), func?: () => Promise<void>) => Promise<void>;
export const ApiContext = React.createContext<ApiCtx>(async () => {});

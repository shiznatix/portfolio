import './globals.d.ts';

import { useMemo, useEffect } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { amber, blue, blueGrey, cyan, deepOrange, green, grey, indigo, lightBlue, lime, orange, pink, purple, red, teal } from '@mui/material/colors';
import {
	alpha,
	darken,
	createTheme,
	lighten,
	PaletteOptions,
	Theme,
	ThemeOptions,
	ThemeProvider,
} from '@mui/material/styles';

type Service = 'mediamtx' | 'piper-voice';

const paletteColors = ['primary', 'secondary', 'error', 'warning', 'info', 'success'] as const;
const palettes = {
	default: {
		primary: blue,
		secondary: purple,
		error: red,
		warning: orange,
		info: lightBlue,
		success: green,
	},
	gray: {
		primary: grey,
		secondary: blueGrey,
	},
	lime: {
		primary: lime,
		secondary: purple,
	},
	ocean: {
		primary: teal,
		secondary: cyan,
	},
	sunset: {
		primary: deepOrange,
		secondary: amber,
	},
	forest: {
		primary: green,
		secondary: teal,
	},
	royal: {
		primary: indigo,
		secondary: pink,
	},
} as const satisfies Record<string, PaletteOptions>;
const servicePalettes: Record<Service, PaletteOptions> = {
	mediamtx: palettes.default,
	'piper-voice': palettes.lime,
} as const;

interface ThemedAppProps {
	children: React.ReactNode;
	theme?: Theme;
	themeOptions?: ThemeOptions;
	service?: Service;
	palette?: PaletteOptions;
}

const ORIGINAL_TITLE = document.title;

export const ThemedApp: React.FC<ThemedAppProps> = ({ children, theme, themeOptions, service, palette }) => {
	useEffect(() => {
		document.title = `${ORIGINAL_TITLE}: ${window.CONFIG.hostname}`;
	}, []);

	const combinedTheme = useMemo(() => {
		const baseTheme = theme || createTheme({
			...themeOptions,
			palette: {
				mode: 'dark',
				...themeOptions?.palette,
				...(service ? servicePalettes[service] : {}),
				...palette,
			},
		});

		return createTheme(baseTheme, {
			palette: Object.fromEntries(
				paletteColors.map(color => [
					color,
					{
						opaqueLight: alpha(baseTheme.palette[color].light, 0.5),
						opaque: alpha(baseTheme.palette[color].main, 0.5),
						opaqueDark: alpha(baseTheme.palette[color].dark, 0.5),
					},
				])
			),
			components: {
				MuiButton: {
					variants: [
						...paletteColors.map(color => ({
							props: { variant: 'soft' as const, color },
							style: {
								backgroundColor: baseTheme.palette[color].opaque,
								color: baseTheme.palette[color].contrastText,
								border: `1px solid ${baseTheme.palette[color].light}`,
								'&:hover': {
									backgroundColor: baseTheme.palette[color].opaqueLight,
									border: `1px solid ${baseTheme.palette[color].dark}`,
								},
							},
						})),
						...paletteColors.map(color => ({
							props: { variant: 'contained' as const, color },
							style: {
								border: `1px solid ${baseTheme.palette[color].light}`,
								'&:hover': {
									border: `1px solid ${baseTheme.palette[color].dark}`,
								},
							},
						})),
					],
				},
			},
		});
	}, [theme, themeOptions]);

	return (
		<ThemeProvider theme={combinedTheme}>
			<CssBaseline />
			{children}
		</ThemeProvider>
	);
};

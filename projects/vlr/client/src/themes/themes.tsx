import colors, { ColorValues } from './colors';

type Palette = {
	primary?: ColorValues;
	neutral?: ColorValues;
	success?: ColorValues;
	warning?: ColorValues;
	danger?: ColorValues;
	text?: {
		primary?: string;
		secondary?: string;
		tertiary?: string;
		icon?: string;
	};
	background?: {
		body?: string;
		surface?: string;
		popup?: string;
		level1?: string;
		level2?: string;
		level3?: string;
		tooltip?: string;
		backdrop?: string;
	};
};

export const blue: Palette = {
	primary: colors.blue,
	neutral: colors.sky,
	success: colors.teal,
	warning: colors.cyan,
	danger: colors.amber,
};
export const lime: Palette = {
	primary: colors.lime,
	neutral: colors.emerald,
	success: colors.green,
	warning: colors.violet,
	danger: colors.purple,
	text: {
		primary: colors.green[950],
		secondary: colors.lime[950],
	},
};
export const amber: Palette = {
	primary: colors.amber,
	neutral: colors.orange,
	success: colors.rose,
	warning: colors.yellow,
	danger: colors.red,
};
export const rose: Palette = {
	primary: colors.rose,
	neutral: colors.fuchsia,
	success: colors.green,
	warning: colors.yellow,
	danger: colors.red,
};

const dev: Palette = {
	//
};

// TODO try this builder https://mui.com/joy-ui/customization/theme-builder/

export default {
	blue,
	lime,
	dev,
	amber,
	rose,
};

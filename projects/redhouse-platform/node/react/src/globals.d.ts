export {};

declare global {
	interface WindowConfig {
		hostname: string;
	}

	interface Window {
		CONFIG: WindowConfig;
	}
}

declare module '@mui/material/Button' {
	interface ButtonPropsVariantOverrides {
		soft: true;
	}
}

declare module '@mui/material/styles' {
	interface PaletteColor {
		opaqueLight: string;
		opaque: string;
		opaqueDark: string;
	}
	interface SimplePaletteColorOptions {
		opaqueLight?: string;
		opaque?: string;
		opaqueDark?: string;
	}
}

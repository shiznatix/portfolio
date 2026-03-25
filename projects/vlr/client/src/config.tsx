import { ViewKey, VolumeControl } from './types';
import themes from './themes/themes';

declare global {
    interface Window {
		CONFIG: {
			name: string;
			defaultVolumeControl: VolumeControl;
			volumeControls: VolumeControl[];

			masterServer?: string;
			cecTvAddress?: string;
			mediaDriveDirs?: string[];
			labelDirs?: string[];
			showDirs?: string[];
			themeName?: keyof typeof themes;
		},
	}
}

export const config = Object.freeze({
	name: window.CONFIG.name || 'VLR',
	defaultVolumeControl: window.CONFIG.defaultVolumeControl || 'vlc',
	volumeControls: window.CONFIG.volumeControls || ['vlc'],
	masterServer: window.CONFIG.masterServer || null,
	cecTvAddress: window.CONFIG.cecTvAddress || null,
	mediaDriveDirs: window.CONFIG.mediaDriveDirs || [],
	labelDirs: window.CONFIG.labelDirs || [],
	showDirs: window.CONFIG.showDirs || [],
	themeName: window.CONFIG.themeName || null,
	// defaultViewKey: 'browse' as ViewKey,
	// defaultViewKey: 'fsEpisodes' as ViewKey,
	defaultViewKey: 'random' as ViewKey,
	// defaultViewKey: 'downloads' as ViewKey,
	// defaultViewKey: 'status' as ViewKey,
});

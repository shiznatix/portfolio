import { action } from '../../core/service/annotations';
import { pythonService } from '../../core/service/service-factory';

export type RhHubProps = {
	clientConfig: {
		cameraGroups: {
			group: string;
			cameras: {
				name: string;
				mjpgUrl: string | null;
				rtcPeerUrl: string;
				statsUrl: string;
				readerStatsUrlTemplate: string;
				recordingsUrl: string | null;
				servosUrl: string | null;
				canPan: boolean;
				canTilt: boolean;
				canShutter: boolean;
				rotateDegrees: 0 | 90 | 180 | 270;
			}[];
		}[];
		medias: string[];
		grafanaDashboards: string[];
		refreshStatsMs: number;
		refreshStreamsMs: number;
	};
	ports?: {
		http?: number;
	};
};

export default pythonService<RhHubProps>()({
	name: 'rh-hub',
	configJsonDir: 'public/',
	isDirMaster: true,
	ports: {
		http: 80,
	},
})(Base => class extends Base {
	configJson = this.props.clientConfig;
	configEnv = {
		HTTP_PORT: this.port('http'),
	};

	@action('build')
	@(action('install').required('build'))
	@(action('sync').required('build'))
	async build() {
		await this.localCmd('npm', ['run', 'build'], {
			cwd: this.localDir,
		});
	}

	@(action('sync').optional('client'))
	async sync() {
		if (this.flagsIncludeExplicit('client')) {
			await this.rsyncUp({
				localSubPath: 'public/',
				destSubPath: 'public',
				excludes: [
					'config.json',
					'index.html',
				],
			});
			return;
		}

		await this.rsyncUp({
			localSubPath: 'public/',
			destSubPath: 'public',
		});
		await this.rsyncUp({
			localSubPath: 'hub.py',
			destSubPath: 'hub.py',
		});
	}

	// async dev() {
	// 	const checkPath = (path: string) => {
	// 		return path.startsWith(`${this.localSrcDir}/public`) || path.endsWith('/hub.py') || path.endsWith('/rh-hub.service');
	// 	};
	// 	const onChange = async () => {
	// 		await this.sync();
	// 	};
	// 	const watchBuildProc = this.localCmd('npm', ['run', 'build:watch'], {
	// 		cwd: this.localSrcDir,
	// 	});
	// 	const logsProc = this.logs('-f');

	// 	await this.devNotifier(checkPath, onChange);
	// 	await watchBuildProc;
	// 	await logsProc;
	// },
});

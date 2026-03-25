import { CCommon } from '../../core/service/configs';
import { stackService } from '../../core/service/service-factory';
import secrets from '../../../secrets.json';
import { ucfirst } from '../../utils';
import { redhouse } from '../hosts/redhouse/local';

export type VlrProps = {
	mediaPaths: string[];
	name?: string;
	webScraper?: string;
	vlc?: {
		password: string;
	};
	sync?: {
		mediaEnabled?: boolean;
		mediaStartDelay?: number;
		mediaLoopDelay?: number;
		imdbEnabled?: boolean;
		imdbStartDelay?: number;
		imdbLoopDelay?: number;
	};
	client?: {
		themeName?: string;
		favicoColor?: string;
		favicoBackgroundColor?: string;
		defaultVolumeControl?: 'system' | 'tv' | 'vlc';
		volumeControls?: ('system' | 'tv' | 'vlc')[];
	};
	hdmiCec?: {
		tvAddress: number;
	};
	ports?: {
		vlc?: number;
		server?: number;
		client?: number;
	};
};

export default stackService<VlrProps>()({
	name: 'vlr',
	isDirMaster: true,
	props: {
		webScraper: redhouse.url('webScraper'),
		vlc: {
			password: secrets.vlc.apiPassword,
		},
	},
	ports: {
		vlc: 8080,
		server: 8081,
		client: 80,
	},
})

.sysd('vlc', {
	workSubDir: 'vlc',
	serviceTemplate: 'service',
	httpPort: 'vlc',
	unitOwnedPorts: ['vlc'],
	mixinRsync: 'no-triggers',
})
(Base => class extends Base {
	aptDependencies = [
		'vlc',
	];
	unitExecStart = `/usr/bin/cvlc --extraintf http --http-host 0.0.0.0 --http-port {{HTTP_PORT}} --http-password ${this.props.vlc!.password}`;
})

.sysd('vlr-server', {
	isDev: true,
	isPython: true,
	serviceTemplate: 'server',
	unitOwnedPorts: ['server'],
})
(Base => class extends Base {
	rsyncUpExcludes = [
		'cache',
	];
	configJson = {
		sync: this.props.sync,
		webScraper: this.props.webScraper,
		vlc: {
			password: this.props.vlc!.password,
			url: this.url('vlc'),
		},
		mediaPaths: this.props.mediaPaths,
		showPaths: this.props.mediaPaths.map(p => `${p}/Shows`),
		moviePaths: this.props.mediaPaths.flatMap(p => ([
			`${p}/Movies.A-N`,
			`${p}/Movies.O-Z`,
		])),
	};
})

.sysd('vlr-client', {
	isDev: true,
	isPython: true,
	isNpm: true,
	serviceTemplate: 'client',
	unitOwnedPorts: ['client'],
})
(Base => class extends Base {
	configJson = {
		name: this.props.name ?? `VLR ${ucfirst(this.host.name)}`,
		serverHost: this.url('server'),
		...this.props.client,
	};
	piInterfaces: CCommon.Pi['piInterfaces'] = [
		['blanking', false],
	];
})

.build({
	isInstallDir: true,
})();

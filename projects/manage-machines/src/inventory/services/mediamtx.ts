import { HostIpAndPorts } from '../../core/host/host-refs';
import { IService } from '../../core/service/service-types';
import { RhImageDetectorModel } from './rh-image-detector';
import { action, hook } from '../../core/service/annotations';
import { stackService } from '../../core/service/service-factory';

// https://github.com/bluenviron/mediamtx/blob/main/mediamtx.yml

type CameraModifiers = {
	rotate?: 1 | 2 | 3;
	sourceWidth?: number;
	sourceHeight?: number;
	sourceFramerate?: number;
	streamQuality?: 'low' | 'medium';
	closeAfterSec?: number; // close the stream after this many seconds of inactivity
	colorFormat?: 'rgb' | 'bgr' | 'yuv420p';
	overlays?: boolean;
} & (
	{
		detectors: RhImageDetectorModel[];
		detectorHost: HostIpAndPorts<['input', 'output']>;
		outWidth: number | string;
		outHeight: number | string;
	} | {
		detectors?: never;
		detectorHost?: never;
	}
);
type PiCamera = {
	type: 'picam';
	hflip?: boolean;
	vflip?: boolean;
	overlays?: boolean;
	brightness?: number; // float, -1 and 1
	contrast?: number; // int, 0 - 16
	saturation?: number; // int, 0 - 16
	sharpness?: number; // int, 0 - 16
	exposure?: 'normal' | 'short' | 'long' | 'custom';
	bitrate?: number;
	autoWhiteBalance?: 'auto' | 'incandescent' | 'tungsten' | 'fluorescent' | 'indoor' | 'daylight' | 'cloudy' | 'custom';
	shutterSpeed?: number;
	gain?: number;
	metering?: 'centre' | 'spot' | 'matrix' | 'custom';
	rawConfigOverrides?: string[];
} & (
	{
		secondaryStream?: false | never;
		cameraCodec?: 'auto' | 'hardwareH264' | 'softwareH264' | 'mjpeg';
	} | {
		secondaryStream: true;
		cameraCodec?: 'auto' | 'mjpeg';
	}
)
type UsbCamera = CameraModifiers & {
	type: 'usb';
	device: string;
	format?: 'mjpeg' | 'yuyv422';
};
type MjpegCamera = CameraModifiers & {
	type: 'mjpeg';
	url: string;
};
export type RtspCamera = CameraModifiers & {
	type: 'rtsp';
	url: string;
};
type DynamicCamera = Pick<CameraModifiers, 'rotate' | 'streamQuality' | 'closeAfterSec' | 'overlays' | 'detectors' | 'detectorHost'> & {
	type: 'dynamic';
	url: string;
	pathPrefix: string;
};

type Camera = {
	outWidth?: number | string;
	outHeight?: number | string;
	outFramerate?: number | string;
	record?: boolean;
	recordPath?: string;
	recordDeleteAfter?: string;
	recordPartDuration?: string;
	recordMaxPartSize?: string;
	recordSegmentDuration?: string;
	// props used by client
	clientRotate?: 0 | 90 | 180 | 270;
	rhServos?: {
		url: string;
		canPan?: boolean;
		canTilt?: boolean;
		canShutter?: boolean;
	};
} & (
	{
		onDemand: boolean;
		startTimeoutSec?: number; // timeout for the camera to start streaming
	} | {
		onDemand?: never;
		startTimeoutSec?: never;
	}
) & (
	| PiCamera
	| UsbCamera
	| MjpegCamera
	| RtspCamera
	| DynamicCamera
);

export type MediaMtxProps = {
	color?: 'warning' | 'error' | 'primary' | 'success';
	cameras: Record<string, Camera>;
	bindIp?: string;
	ports?: {
		api?: number;
		metrics?: number;
		webrtc?: number;
		rtsp?: number;
		rtmp?: number;
		client?: number;
	};
};

export const mediaMtxCamUrl = (
	service: IService<MediaMtxProps>,
	portOrApi: 'rtsp' | 'rtmp' | 'webrtc' | 'web' | 'api-stats' | 'api-reader-stats' | 'api-recordings',
	cameraName: string,
) => {
	const protocol = [
		'api', 'api-stats', 'api-reader-stats',
		'api-recordings', 'metrics', 'webrtc', 'web',
	].includes(portOrApi) ? 'http' : portOrApi;
	const realPortName = (portOrApi.startsWith('api')
		? 'api'
		: portOrApi === 'web'
			? 'webrtc'
			: portOrApi) as keyof MediaMtxProps['ports'];
	const port = service.port(realPortName);
	const url = `${protocol}://${service.host.ip}:${port}`;

	if (portOrApi === 'api-stats') {
		return `${url}/v3/paths/get/${String(cameraName)}`;
	} else if (portOrApi === 'api-reader-stats') {
		return `${url}/v3/{type}/get/{id}`;
	} else if (portOrApi === 'api-recordings') {
		return `${url}/v3/recordings/get/${String(cameraName)}`;
	} else if (portOrApi === 'webrtc') {
		return `${url}/${String(cameraName)}/whep`;
	}
	return `${url}/${String(cameraName)}`;
};

const VERSION = 'v1.16.3';
const DOWNLOAD_URL = `https://github.com/bluenviron/mediamtx/releases/download/${VERSION}/mediamtx_${VERSION}_linux_{{ARCH}}.tar.gz`;

export default stackService<MediaMtxProps>()({
	name: 'mediamtx',
	isDirMaster: true,
	isDev: true,
	isPython: true,
	props: {
		cameras: {},
	},
	ports: {
		api: 9997,
		metrics: 9998,
		webrtc: 8889,
		rtsp: 8554,
		rtmp: 1935,
		client: 9999,
	},
})

.sysd('mediamtx-server', {
	configJson: true,
	serviceTemplate: 'server',
	debugFiles: ['mediamtx.yml', 'path_*.sh'],
	rsyncUpExcludes: ['mediamtx', 'mediamtx.yml'],
	aptDependencies: ['ffmpeg', 'rclone'],
	unitExecStartPre: '{{INSTALL_PATH}}/.venv/bin/python {{INSTALL_PATH}}/src/mediamtx.py',
	// Get rid of super spam log message from some rpi cams
	// unitExecStart: `/bin/sh -c '{{INSTALL_PATH}}/mediamtx {{INSTALL_PATH}}/mediamtx.yml 2>&1 | grep -v "Unable to set controls"'`,
	unitExecStart: `{{INSTALL_PATH}}/mediamtx {{INSTALL_PATH}}/mediamtx.yml`,
})
(Base => class extends Base {
	unitExecStartPost = [
		`/bin/bash -c '`,
		'echo "--------";',
		'echo "Cameras available at:";',
		...Object.keys(this.props.cameras).map(name => `echo "  ${mediaMtxCamUrl(this, 'web', name)}";`),
		'echo "--------";',
		`'`,
	].join('');
	sudoers = [
		'/usr/bin/tee /etc/udev/rules.d/99-dma_heap.rules',
		'/usr/bin/udevadm control --reload-rules',
		'/usr/bin/udevadm trigger',
		'/usr/bin/rm -rf /dev/shm/*',
		'/usr/bin/mkdir -p /dev/shm/*',
		`/usr/bin/chown ${this.host.username}:${this.host.username} /dev/shm/*`,
	];

	@hook('install.begin', t => t.host.groups?.includes('raspberry-pi'))
	async fixUdevRules() {
		await this.cmd(`echo 'SUBSYSTEM=="dma_heap", GROUP="video", MODE="0660"' | sudo tee /etc/udev/rules.d/99-dma_heap.rules`);
		await this.cmd('sudo udevadm control --reload-rules');
		await this.cmd('sudo udevadm trigger');
	}

	@(action('install').optional('build'))
	async install() {
		const arch = await this.arch();
		const downloadUrl = DOWNLOAD_URL.replace('{{ARCH}}', arch === 'aarch64' ? 'arm64' : 'amd64');
		await this.cmd(`curl -L "${downloadUrl}" | tar -xz -C "${this.workDir}"`);
	}

	@action('status')
	async status() {
		const { stdout } = await this.cmd(`${this.workDir}/mediamtx --version`, {
			noFail: true,
		});
		const installedVersion = stdout.trim();
		if (installedVersion !== VERSION) {
			this.log.warn(`Mediamtx version ${installedVersion} does not match expected version ${VERSION}`);
		}
	}


	@(action('test').optional(['devices', 'formats', 'controls', 'all', 'lsusb', 'rpicam-vid']))
	async actionTest() {
		const opts = {
			noFail: true,
			silent: true,
		};
		const deviceSuffix = typeof this.flags.number === 'number'
			? `-d /dev/video${this.flags.number}`
			: '';

		if (this.flagsInclude('devices')) {
			const devices = await this.cmd(`v4l2-ctl --list-devices ${deviceSuffix}`, opts);
			console.log('---------v4l2-ctl DEVICES---------');
			console.log(devices.stdout);
			console.log(devices.stderr);
		}
		if (this.flagsInclude('formats')) {
			const formats = await this.cmd(`v4l2-ctl --list-formats-ext ${deviceSuffix}`, opts);
			console.log('---------v4l2-ctl FORMATS---------');
			console.log(formats.stdout);
			console.log(formats.stderr);
		}
		if (this.flagsInclude('controls')) {
			const controls = await this.cmd(`v4l2-ctl --list-ctrls ${deviceSuffix}`, opts);
			console.log('---------v4l2-ctl CONTROLS---------');
			console.log(controls.stdout);
			console.log(controls.stderr);
		}
		if (this.flagsInclude('all')) {
			const all = await this.cmd(`v4l2-ctl --all ${deviceSuffix}`, opts);
			console.log('---------v4l2-ctl ALL---------');
			console.log(all.stdout);
			console.log(all.stderr);
		}
		if (this.flagsInclude('lsusb')) {
			const lsusb = await this.cmd('lsusb', opts);
			console.log('---------lsusb---------');
			console.log(lsusb.stdout);
			console.log(lsusb.stderr);
		}
		if (this.flagsInclude('rpicam-vid')) {
			const rpiCameras = await this.cmd('rpicam-vid --list-cameras', opts);
			console.log('---------rpicam-vid---------');
			console.log(rpiCameras.stdout);
			console.log(rpiCameras.stderr);
		}
	}
})

.sysd('mediamtx-client', { isNpm: true, serviceTemplate: 'client' })
(Base => class extends Base {
	configJson = {
		name: this.host.name,
		color: this.props.color || 'primary',
		cameras: Object.entries(this.props.cameras)
			.map(([name, cam]) => ({
				name,
				type: cam.type,
				rtcPeerUrl: mediaMtxCamUrl(this, 'webrtc', name),
				mjpgUrl: cam.type === 'mjpeg'
					? cam.url
					// : cam.type === 'picam' && cam.secondaryStream
					// 	? mediaMtxCamUrl(this, 'mjpeg', name)
						: null,
				statsUrl: mediaMtxCamUrl(this, 'api-stats', name),
				readerStatsUrlTemplate: mediaMtxCamUrl(this, 'api-reader-stats', name),
				recordingsUrl: mediaMtxCamUrl(this, 'api-recordings', name),
				rotate: cam.clientRotate || 0,
				// rh-servos
				servosUrl: cam.rhServos?.url ?? null,
				canPan: !!cam.rhServos?.canPan,
				canTilt: !!cam.rhServos?.canTilt,
				canShutter: !!cam.rhServos?.canShutter,
			}))
			.filter(c => c.type !== 'dynamic'),
	};
})

.build({
	isInstallDir: true,
})(Base => class extends Base {
	props: MediaMtxProps = {
		...this.props,
		cameras: Object.entries(this.props.cameras).reduce((acc, [name, cam]) => {
			// if the url is a "local cam name" then convert to full URL
			if ('url' in cam && cam.url && !cam.url.includes('://')) {
				cam.url = mediaMtxCamUrl(this, 'rtsp', cam.url);
			}

			acc[name] = cam;
			return acc;
		}, {} as Record<string, Camera>),
	};
});

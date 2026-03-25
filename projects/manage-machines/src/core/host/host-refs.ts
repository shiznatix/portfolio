import { getHost, type HostName } from '../../inventory/hosts';
import { ServiceName } from '../../inventory/services';
import sensorSchema from '../../json-schema';
import type Host from './host';
import { TSchema } from '@sinclair/typebox';
import { buildUrl } from '../url';
import { mediaMtxCamUrl, MediaMtxProps } from '../../inventory/services/mediamtx';

export type HostUrlAndName = { name: string; url: string };
export type HostIpAndPorts<TPorts extends readonly string[]> = { ip: string } & { [K in TPorts[number]]: number };
export type HostIpAndPort = { ip: string; port: number };
export type HostRedisUrlAndChannels = { url: string; channels: string[] };

abstract class AbstractUriString extends String {
	protected _host?: Host;
	protected get host(): Host {
		if (!this._host) {
			this._host = getHost(this.hostName) as any;
		}
		return this._host!;
	}

	constructor(readonly hostName: HostName) {
		super('');
	}

	abstract build(): string;

	override toString(): string {
		return this.build();
	}
	override valueOf(): string {
		return this.build();
	}
	[Symbol.toPrimitive](): string {
		return this.build();
	}
	toJSON(): unknown {
		return this.build();
	}
}

abstract class AbstractUriObject {
	protected _host?: Host;
	protected get host(): Host {
		if (!this._host) {
			this._host = getHost(this.hostName) as any;
		}
		return this._host!;
	}

	constructor(readonly hostName: HostName) {}

	abstract build(): unknown;

	toString(): string {
		return this.build() as string;
	}
	toJSON(): unknown {
		return this.build();
	}
}

/**
 * Get a sensor schema for a host sensor.
 *
 * @example
 * const schema = new SensorSchema('bedroom', 'temperature');
 * schema.build() // → { name: 'temperature', value: ... }
 */
export class SensorSchema extends AbstractUriObject {
	readonly valueSchema?: TSchema;

	constructor(
		hostName: HostName,
		readonly sensorName: string,
		valueSchema?: TSchema
	) {
		super(hostName);
		this.valueSchema = valueSchema;
	}

	build(): TSchema {
		return sensorSchema(this.sensorName, this.valueSchema);
	}
}

/**
 * Get the IP address of a host.
 *
 * @example
 * const ip = new HostIpOnly('bedroom');
 * ip.toString() // → '192.168.1.10'
 */
export class HostIpOnly extends AbstractUriString {
	build(): string {
		return this.host.ip;
	}
}

/**
 * Get a drive path on a host.
 *
 * @example
 * const drivePath = new HostDrive('bedroom', 'media');
 * drivePath.toString() // → '/mnt/media'
 */
export class HostDrive extends AbstractUriString {
	protected _drivePath?: string;
	readonly subPath?: string;

	protected get drivePath(): string {
		if (!this._drivePath) {
			const drives = this.host.config.drives;
			if (!drives || !(this.driveName in drives)) {
				throw new Error(`Drive '${this.driveName}' not found on host '${this.hostName}'`);
			}
			this._drivePath = drives[this.driveName];
		}
		return this._drivePath!;
	}

	constructor(
		hostName: HostName,
		readonly driveName: string,
		subPath?: string
	) {
		super(hostName);
		this.subPath = subPath
			? subPath.startsWith('/')
				? subPath
				: `/${subPath}`
			: subPath;
	}

	build(): string {
		const subpath = this.subPath || '';
		return `${this.drivePath}${subpath}`;
	}
}

/**
 * Get a service URL on a host.
 *
 * @example
 * const url = new Url('bedroom', 'vlr');
 * url.toString() // → 'http://...'
 *
 * // With port name:
 * const url = new Url('bedroom', 'vlr', { portName: 'server' });
 * url.toString() // → 'http://192.168.1.10:8081'
 *
 * // With path:
 * const url = new Url('bedroom', 'vlr', { path: '/api/status' });
 * url.toString() // → 'http://192.168.1.10:8080/api/status'
 *
 * // Just IP and path (no service):
 * const url = new Url('bedroom', undefined, { path: '/status' });
 * url.toString() // → 'http://192.168.1.10/status'
 *
 * // Basic auth:
 * const url = new Url('bedroom', undefined, { protocol: 'https', password: 'pass', port: '8080', path: '/api' });
 * url.toString() // → 'https://user:pass@192.168.1.10:8080/api'
 */
export class Url extends AbstractUriString {
	readonly serviceName?: string;
	readonly opts?: {
		portName?: string;
		path?: string;
		protocol?: string;
		password?: string;
		port?: string;
	};

	constructor(
		hostName: HostName,
		serviceOrOptsOrPath?: string | { portName?: string; path?: string; protocol?: string; password?: string; port?: string },
		optsOrPath?: { portName?: string; path?: string; protocol?: string; password?: string; port?: string } | string,
		opts?: { portName?: string; path?: string; protocol?: string; password?: string; port?: string }
	) {
		super(hostName);

		// Determine what was passed
		if (typeof serviceOrOptsOrPath === 'string') {
			if (serviceOrOptsOrPath.startsWith('/')) {
				// First param is a path
				this.opts = { path: serviceOrOptsOrPath };
				if (optsOrPath && typeof optsOrPath === 'object') {
					this.opts = { ...this.opts, ...optsOrPath };
				}
			} else {
				// First param is a service name
				this.serviceName = serviceOrOptsOrPath;
				if (typeof optsOrPath === 'string' && optsOrPath.startsWith('/')) {
					// Second param is a path
					this.opts = { path: optsOrPath, ...opts };
				} else if (optsOrPath && typeof optsOrPath === 'object') {
					// Second param is opts
					this.opts = optsOrPath;
				}
			}
		} else if (serviceOrOptsOrPath && typeof serviceOrOptsOrPath === 'object') {
			// First param is opts
			this.opts = serviceOrOptsOrPath;
		}

		// handle special services
		if (this.serviceName === 'redis') {
			this.opts = {
				...this.opts,
				protocol: 'redis',
				portName: 'redis',
			};
		}
	}

	build(): string {
		const { portName, path, protocol, password, port } = this.opts || {};

		// Service-based URL
		if (this.serviceName) {
			const service = this.host.service(this.serviceName as ServiceName);
			return service.url({
				// @ts-expect-error - url() signature varies by service
				port: portName || port,
				path,
				protocol,
				password,
			});
		}

		return buildUrl(this.host.ip, {
			port: port || portName,
			path,
			protocol,
			password,
			username: password && this.host.username,
		});
	}
}

/**
 * Get a MediaMTX camera URL.
 *
 * @example
 * const cameraUrl = new MediaMtxCameraUrl('bedroom', 'picam');
 * cameraUrl.toString() // → 'rtsp://192.168.1.10:8554/picam'
 */
export class MediaMtxCameraUrl extends AbstractUriString {
	constructor(
		hostName: HostName,
		readonly cameraName: string
	) {
		super(hostName);
	}

	build(portOrApi: 'rtsp' | 'rtmp' | 'webrtc' | 'api-stats' | 'api-reader-stats' | 'api-recordings' = 'rtsp'): string {
		try {
			return mediaMtxCamUrl(this.host.service('mediamtx'), portOrApi, this.cameraName);
		} catch (error) {
			console.log(error);
			process.exit(1);
		}
	}
}

/**
 * Get a Redis server URL and service channel matchers.
 *
 * @example
 * const redisUrl = new RedisUrl('bedroom', 'rh-sensors');
 * redisUrl.toJSON() // → { url: 'redis://192.168.1.10:6379', channels: ['rh-sensors:*'] }
 */
export class RedisUrlAndChannels extends Url {
	protected channelPatterns: string[];

	constructor(
		hostName: HostName,
		channelPatterns: string | string[],
	) {
		super(hostName, 'redis', {
			portName: 'redis',
			protocol: 'redis',
		});
		this.channelPatterns = Array.isArray(channelPatterns) ? channelPatterns : [channelPatterns];
	}

	toJSON(): HostRedisUrlAndChannels {
		return {
			url: super.build(),
			channels: this.channelPatterns,
		};
	}
}

/**
 * Get a URL and host name combination.
 *
 * @example
 * const urlAndName = new UrlAndName('bedroom', 'vlr');
 * urlAndName.toString() // → 'http://...'
 * urlAndName.toJSON()   // → { name: 'bedroom', url: 'http://...' }
 */
export class UrlAndName extends Url {
	toJSON(): HostUrlAndName {
		return {
			name: this.host.name,
			url: super.build(),
		};
	}
}

/**
 * Get multiple IP:port combinations for a service.
 *
 * @example
 * const ports = new IpAndPorts('bedroom', 'vlr', ['server', 'client']);
 * ports.toString() // → '192.168.1.10:8081:80'
 * ports.toJSON()   // → { ip: '192.168.1.10', server: 8081, client: 80 }
 */
export class IpAndPorts<TPorts extends readonly string[] = readonly string[]> extends AbstractUriObject {
	protected _ports?: { [K in TPorts[number]]: number };

	protected get ports(): { [K in TPorts[number]]: number } {
		if (!this._ports) {
			const service = this.host.service(this.serviceName as ServiceName);
			this._ports = this.portNames.reduce((acc, portName) => {
				// @ts-expect-error - port() is from mixin
				acc[portName] = service.port(portName);
				return acc;
			}, {} as { [K in TPorts[number]]: number });
		}
		return this._ports;
	}

	constructor(
		hostName: HostName,
		readonly serviceName: string,
		readonly portNames: TPorts
	) {
		super(hostName);
	}

	build(): HostIpAndPorts<TPorts> {
		return {
			ip: this.host.ip,
			...this.ports,
		};
	}

	toString(): string {
		return Object.values(this.build()).join(':');
	}
}

/**
 * Get a value from the host's stubProps at a given path.
 *
 * @example
 * const val = new SubProps('bedroom.vlr.port', { fooPort: 1234 });
 * val.toJSON() // → value at stubProps.vlr.port
 */
export class SubProps extends AbstractUriObject {
	constructor(
		hostName: HostName,
		readonly path: string[],
		readonly extend?: Record<string, unknown>
	) {
		super(hostName);
	}

	build(): unknown {
		const stubProps = this.host.config.stubProps;
		const resolved = stubProps
			? this.path.reduce((obj: any, key) => obj?.[key], stubProps)
			: {};
		const extend = this.extend || {};
		return {
			...resolved,
			...extend,
		};
	}
}

/**
 * Get an IP:port combination for a service.
 *
 * @example
 * const ipPort = new IpAndPort('bedroom', 'vlr', 'server');
 * ipPort.toString() // → '192.168.1.10:8081'
 * ipPort.toJSON()   // → { ip: '192.168.1.10', port: 8081 }
 */
export class IpAndPort extends AbstractUriObject {
	protected _port?: number;

	protected get port(): number {
		if (!this._port) {
			const service = this.host.service(this.serviceName as ServiceName);
			// @ts-expect-error
			this._port = service.port(this.portName);
		}
		return this._port;
	}

	constructor(
		hostName: HostName,
		readonly serviceName: string,
		readonly portName: string
	) {
		super(hostName);
	}

	build(): HostIpAndPort {
		return {
			ip: this.host.ip,
			port: this.port,
		};
	}

	toString(): string {
		return `${this.host.ip}:${this.port}`;
	}
}

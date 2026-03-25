import { HostName } from '../../inventory/hosts';
import {
	MediaMtxCameraUrl,
	Url,
	IpAndPort,
	IpAndPorts,
	HostDrive,
	SensorSchema,
	HostIpOnly,
	RedisUrlAndChannels,
	HostRedisUrlAndChannels,
	SubProps,
} from './host-refs';
import type { HostProps } from '../../inventory/hosts';
import type { ServiceProps } from '../../inventory/services';
import { TSchema } from '@sinclair/typebox';

type UrlPath = `/${string}`;

type UrlOpts = {
	portName?: string;
	path?: UrlPath;
	protocol?: string;
	password?: string;
	port?: string;
};

// Compute all valid dot-notation paths of an object type up to 3 levels deep.
type Paths<T, D extends 0[] = []> = D['length'] extends 3
	? never
	: T extends object
	? { [K in keyof T & string]: K | `${K}.${Paths<NonNullable<T[K]>, [0, ...D]>}` }[keyof T & string]
	: never;

// Resolve the type at a dot-notation path within an object type.
type DeepGet<T, P extends string> =
	P extends `${infer K}.${infer Rest}`
		? K extends keyof T
			? DeepGet<NonNullable<T[K]>, Rest>
			: never
		: P extends keyof T
			? T[P]
			: never;

// Extract the first key from a dot-notation path ('a.b.c' → 'a', 'a' → 'a').
type HeadKey<P extends string> = P extends `${infer K}.${string}` ? K : P;
// Extract everything after the first dot ('a.b.c' → 'b.c', 'a' → never).
type TailPath<P extends string> = P extends `${string}.${infer R}` ? R : never;

// Resolve a dot-notation path against the canonical ServiceProps schema,
// bypassing const-narrowing on host props. Falls back to unknown for unknown services.
type SchemaDeepGet<P extends string> =
	HeadKey<P> extends keyof ServiceProps
		? TailPath<P> extends string
			? DeepGet<ServiceProps[HeadKey<P>], TailPath<P>>
			: ServiceProps[HeadKey<P>]
		: unknown;

export function createLocalContext<N extends HostName>(hostName: N) {
	type Props = HostProps<N>;

	// Extract camera names if mediamtx props exist.
	// For static cameras, the key is the type; for dynamic cameras (type: 'dynamic'),
	// the type is a template `${pathPrefix}_WIDTHxHEIGHT_FPS`.
	type CameraKeys = Props extends { mediamtx: { cameras: infer C } }
		? {
			[K in keyof C & string]: C[K] extends { type: 'dynamic'; pathPrefix: infer P extends string }
				? `${P}_${number}x${number}_${number}`
				: K;
		}[keyof C & string]
		: never;


	// Extract sensor names if rh-sensors props exist
	type SensorKeys = Props extends { 'rhSensors': { sensors: infer S } }
		? keyof S & string
		: Props extends { 'rh-sensors': { sensors: infer S } }
			? keyof S & string
			: never;

	// Extract notifier names if rh-image-detector props exist
	type ImageNotifierKeys = Props extends { 'rhImageDetector': { notifiers: infer N } }
		? keyof NonNullable<N> & string
		: Props extends { 'rh-image-detector': { notifiers: infer N } }
			? keyof NonNullable<N> & string
			: never;

	// Extract service names from the props keys
	type ServiceKeys = keyof Props & string;

	type ServiceChannel =
		ServiceKeys | `${ServiceKeys}:*`
		| `rh-sensors:*` | `rh-sensors:${SensorKeys}`
		| `rh-image-detector:*` | `rh-image-detector:${ImageNotifierKeys}`;

	// Extract drive names if drives exist in config
	type DriveKeys = string;

	return {
		// Generate MediaMTX camera URL for a camera on this host
		mediamtxUrl: (camera: CameraKeys): string =>
			new MediaMtxCameraUrl(hostName, camera) as any,

		redisAndChannels: (serviceNames: ServiceChannel | ServiceChannel[]): HostRedisUrlAndChannels =>
			new RedisUrlAndChannels(hostName, serviceNames) as any,

		// Generate service URL for a service on this host
		url: (serviceOrOptsOrPath?: ServiceKeys | UrlOpts | UrlPath, optsOrPath?: UrlOpts | UrlPath, opts?: UrlOpts) =>
			new Url(hostName, serviceOrOptsOrPath as any, optsOrPath as any, opts) as any,

		// Generate IP:port for a service on this host
		ipAndPort: (service: ServiceKeys, port?: string) =>
			new IpAndPort(hostName, service, port ?? 'http') as any,

		// Generate multiple IP:port combinations for a service on this host
		ipAndPorts: (service: ServiceKeys, ...ports: string[]) =>
			new IpAndPorts(hostName, service, ports) as any,

		// Generate drive path for a drive on this host
		drive: (driveName: DriveKeys, subPath?: string) =>
			new HostDrive(hostName, driveName, subPath) as any,

		// Get IP address of this host
		ip: () =>
			new HostIpOnly(hostName) as any,

		// Generate sensor schema for a sensor on this host
		sensorSchema: (sensorName: SensorKeys, valueSchema?: TSchema) =>
			new SensorSchema(hostName, sensorName, valueSchema) as any,

		// Read a value from host.config.stubProps at the given path,
		// optionally merged with an extension object of the same type.
		subProps: <P extends Paths<Props>>(path: P, extend?: SchemaDeepGet<P> extends object ? Partial<SchemaDeepGet<P>> : never) =>
			new SubProps(
				hostName,
				path.split('.'),
				extend,
			) as SchemaDeepGet<P>,
	};
}

export type LocalContext = ReturnType<typeof createLocalContext>;

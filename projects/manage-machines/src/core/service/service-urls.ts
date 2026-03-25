import type Host from '../host/host';
import { prettyJson } from '../../utils';
import ServiceTriggers from './service-triggers';
import { InferPorts, ServiceUrlOpts } from './service-types';
import { buildUrl } from '../url';

export default abstract class ServiceUrls<P> extends ServiceTriggers {
	abstract name: string;
	abstract host: Host;
	abstract props?: P;

	port<K extends keyof InferPorts<P>>(portName: K) {
		// @ts-expect-error
		const port = this.props?.ports?.[portName];

		if (!port) {
			// @ts-expect-error
			this.log.error('Ports available:', prettyJson(this.props?.ports));
			throw new Error(`Port "${String(portName)}" is not defined for service "${this.name}" on host "${this.host.name}".`);
		}

		return port;
	}

	ports(): InferPorts<P> {
		// @ts-expect-error
		return this.props?.ports;
	}

	url<K extends keyof InferPorts<P>>(portOrOpts?: K | ServiceUrlOpts<P>, opts?: ServiceUrlOpts<P>) {
		const finalOpts: ServiceUrlOpts<P> = opts
			? opts
			: portOrOpts && typeof portOrOpts === 'object'
				? portOrOpts
				: {
					port: portOrOpts,
				} as ServiceUrlOpts<P>;

		// @ts-expect-error
		const portNum = finalOpts.port && (finalOpts.port in (this.props?.ports || {}))
			? this.port(finalOpts.port)
			// @ts-expect-error
			: this.port('http');

		return buildUrl(this.host.ip, {
			port: portNum,
			path: finalOpts.path,
			protocol: finalOpts.protocol,
			password: finalOpts.password,
			username: finalOpts.password && this.host.username,
		});
	}
}

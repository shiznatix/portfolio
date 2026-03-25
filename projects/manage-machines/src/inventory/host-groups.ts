import { HostGroup } from './hosts';
import { ServiceName, ServiceProps } from './services';

const groupServices: Partial<Record<HostGroup, Partial<ServiceProps>>> = {
	'raspberry-pi': {
		pi: {},
		'home-bin': {
			group: 'pi',
		},
		wifi: {},
	},
	'all-devices': {
		system: {},
		// alloy: {},
		'prom-node-exporter': {},
	},
};

export function getGroupServices(groups?: readonly HostGroup[]): Partial<ServiceProps> {
	if (!groups?.length) {
		return {};
	}

	return groups.reduce((acc, group) => {
		const services = groupServices[group] || {};
		const serviceNames = Object.keys(services) as ServiceName[];

		for (const serviceName of serviceNames) {
			acc[serviceName] = (acc[serviceName] ?? services[serviceName]) as any;
		}
		return acc;
	}, {} as Partial<ServiceProps>);
}

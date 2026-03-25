import Host from '../core/host/host';
import { arrayUnique } from '../utils';
import { ServiceName } from './services';
import { ArgvFlags } from '../types';
import crazyClock from './hosts/crazy-clock';
import redhouse from './hosts/redhouse';

// Import props for type-level access
import * as crazyClockProps from './hosts/crazy-clock/props';
import * as redhouseProps from './hosts/redhouse/props';

// Type-level map of host names to their props
type HostPropsMap = {
	[crazyClock.name]: typeof crazyClockProps;
	[redhouse.name]: typeof redhouseProps;
};

export type HostName = typeof hosts[number]['name'];
export type Hosts<N extends HostName> = Extract<typeof hosts[number], { name: N }>;
export type HostProps<N extends HostName> = HostPropsMap[N];

const hosts = [
	crazyClock,
	redhouse,
] as const;

export const groups = ['all-devices', 'raspberry-pi', 'ignore', 'disabled'] as const;
export type HostGroup = typeof groups[number];
export type HostKey = HostName | HostGroup;

const enabledHosts = hosts.filter(h => !h.groups?.includes('disabled'));
const hostNames = enabledHosts.filter(h => !h.groups?.includes('ignore')).map(h => h.name) as HostName[];
const hostArray = [...enabledHosts];
const allKeys = arrayUnique([...groups, ...hostNames]);

export const getHost = <N extends HostName>(name: N) => {
	return enabledHosts.find(h => h.name === name)! as Hosts<N>;
};

export const getHostNames = () => {
	return hostNames;
};

export const getHostKeys = () => {
	return allKeys;
};

export const hostExists = (name: HostKey) => {
	return hostNames.includes(name as HostName) || groups.includes(name as HostGroup);
};

export const getHosts = (names?: HostKey[]) => {
	return arrayUnique((names || allKeys)
		.flatMap(n => groups.includes(n as HostGroup)
			? hostArray.filter(h => Array.isArray(h.groups) && h.groups.includes(n as HostGroup))
			: [getHost(n as HostName)],
		),
	).filter(h => h && !h.groups?.includes('disabled')) as Host[];
};

export const getHostGroup = (group: HostGroup): Host[] => {
	return getHosts([group]);
};

export const getHostsWithService = (serviceName: ServiceName) => {
	return enabledHosts.filter(h => h.hasService(serviceName));
};

export const setHostsArgvFlags = (flags: ArgvFlags) => {
	enabledHosts.forEach(h => h.setArgvFlags(flags));
};

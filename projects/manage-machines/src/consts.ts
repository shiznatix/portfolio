import os from 'os';

export type Network = {
	mask: string;
	glob: string;
	tailing: string;
};
export type NetworkFormat = keyof Network;
export type Networks = typeof networks;
export type NetworkName = keyof Networks;

const makeNetwork = (thirdOctet: number) => ({
	mask: `192.168.${thirdOctet}.0/24`,
	glob: `192.168.${thirdOctet}.*`,
	tailing: `192.168.${thirdOctet}.`,
});

const networks = {
	default: makeNetwork(1),
	rhMain: makeNetwork(2),
	rhIot: makeNetwork(9),
	rhHub: makeNetwork(10),
	public: makeNetwork(11),
	vpn: makeNetwork(12),
	gaming: makeNetwork(15),
	iot: makeNetwork(21),

	viimsiJKAR: makeNetwork(20),
} as const;

function networksArray(names: NetworkName[], format: NetworkFormat): string[];
function networksArray(format: NetworkFormat): string[];
function networksArray(names: NetworkName[]): Network[];
function networksArray(): Network[];
function networksArray(namesorFormat?: NetworkFormat | NetworkName[], formatOrNone?: NetworkFormat) {
	const names = Array.isArray(namesorFormat) ? namesorFormat : null;
	const format = typeof namesorFormat === 'string' ? namesorFormat : formatOrNone;
	const matches = names
		? names.map(n => networks[n])
		: Object.values(networks);

	return format ? matches.map(n => n[format]) : matches;
}

const domains = {
	rh: 'rh',
	cam: 'cam',
	iot: 'iot',
} as const;

const workDirBase = '/var/lib';
const localDirBase = `${os.homedir()}/src`;

export default {
	networks,
	networksArray,
	domains,
	workDirBase,
	localDirBase,
} as const;

import fs from 'fs';
import consts from '../../consts';
import { nakedService } from '../../core/service/service-factory';
import { action, hook } from '../../core/service/annotations';
import { getHostGroup, HostKey } from '../hosts';
import { defaultWifiProps } from './wifi';

export type HomeBinProps = {
	hosts?: HostKey[];
	aliases?: Record<string, string>;
	shells?: ('bash' | 'zsh')[];
	group?: CmdGroupAlias;
	cmdGroups?: CmdGroup[];
	defaultPythonVersion?: string;
};

type CmdGroup = typeof CMD_GROUPS[number];
type CmdGroupAlias = keyof typeof GROUP_ALIASES;

const CMD = 'qq';
const CMD_GROUPS = [
	'arduino',
	'crypt',
	'flipper',
	'fs',
	'git',
	'gpu',
	'js',
	'meta',
	'net',
	'pi',
	'py',
	'dev',
	'rpi',
	'sys',
	'vid',
	'zip',
] as const;
const GROUP_ALIASES = {
	default: ['fs', 'zip'],
	pi: ['pi', 'py', 'fs', 'zip'],
	server: ['py', 'fs', 'gpu', 'crypt', 'meta', 'sys', 'zip'],
	shiznatix: CMD_GROUPS.filter(g => g !== 'pi'),
} as const satisfies Record<string, CmdGroup[]>;
const GROUP_SUDOERS = {
	sys: [
		'/usr/bin/apt update',
		'/usr/bin/apt upgrade *',
		'/usr/bin/apt full-upgrade *',
		'/usr/bin/apt autoremove *',
		'/usr/bin/snap refresh',
		'/usr/bin/cat /sys/class/powercap/*/energy_uj',
	],
	net: [
		'/usr/bin/apt install arp-scanm *',
		'/usr/bin/apt install sshpass *',
		'/usr/sbin/arp-scan *',
		'/usr/bin/nmap *',
	],
	gpu: [
		'/usr/bin/prime-select *',
		'/usr/bin/nvidia-smi *',
		'/usr/bin/systemctl * nvidia-persistenced',
	],
} as const satisfies Partial<Record<CmdGroup, string[]>>;

const RPI_WIFI_DEFAULTS = [
	'network:',
	'  version: 2',
	'  wifis:',
	'    home:',
	'      match:',
	'        name: wlan0',
	'      regulatory-domain: "XX"',
	'      access-points:',
	`        "${defaultWifiProps.default.ssid}":`,
	`          password: "${defaultWifiProps.default.password}"`,
	'      dhcp4: true',
	'      optional: true',
	'',
	...defaultWifiProps.extra.flatMap(w => [
		`    ${w.ssid}:`,
		'      match:',
		'        name: wlan0',
		'      regulatory-domain: "XX"',
		'      access-points:',
		`        "${w.ssid}":`,
		`          password: "${w.password}"`,
		'      dhcp4: false',
		'      addresses:',
		'        - {{IP_ADDRESS}}/24',
		'      routes:',
		'        - to: default',
		'          via: {{GATEWAY}}',
		'      nameservers:',
		'        addresses:',
		'          - 8.8.8.8',
		'          - 1.1.1.1',
		'      optional: true',
	]),
].join('\n');

export default nakedService<HomeBinProps>()({
	name: 'home-bin',
	isDirMaster: true,
	mixinRsync: 'no-triggers',
	props: {
		group: 'default',
		defaultPythonVersion: '3.13.5',
	},
})
(Base => class extends Base {
	private readonly hostGroups = this.props.cmdGroups
		? this.props.cmdGroups
		: GROUP_ALIASES[this.props.group || 'default'];
	private readonly groups: {
		all: CmdGroup[];
		install: CmdGroup[];
		exclude: CmdGroup[];
	};
	private readonly bins: {
		all: string[];
		install: string[];
		exclude: string[];
	};
	private readonly rcFilePaths: string[];

	private binsForGroups(groups: CmdGroup[]) {
		// include any linked files from the src/bin folder
		return groups
			.flatMap(g => fs
				.readdirSync(`${this.localDir}/bin/${g}`)
				.map(f => {
					const path = `${this.localDir}/bin/${g}/${f}`;
					if (fs.lstatSync(path).isSymbolicLink()) {
						return fs.readlinkSync(path).split('/').pop()?.trim();
					}
				}),
			)
			.filter(a => a) as string[];
	}

	constructor() {
		super();

		const groupsAll = [...CMD_GROUPS];
		const groupsInstall = this.hostGroups;
		const groupsExclude = groupsAll.filter(g => !groupsInstall.includes(g));
		this.groups = {
			all: groupsAll,
			install: groupsInstall,
			exclude: groupsExclude,
		};

		const binsAll = this.binsForGroups(this.groups.all);
		const binsInstall = this.binsForGroups(this.groups.install);
		const binsExclude = binsAll.filter(a => !binsInstall.includes(a));
		this.bins = {
			all: binsAll,
			install: binsInstall,
			exclude: binsExclude,
		};

		this.rcFilePaths = (this.props.shells || ['bash'])
			.map(s => `/home/${this.host.username}/.${s}rc`);
	}

	get configEnv() {
		const env: Record<string, string> = {
			MMHB_CMD: CMD,
			MMHB_HOSTNAME_TLD: `.${consts.domains.rh}`,
			MMHB_ALIASES: this.props.aliases
				? Object.entries(this.props.aliases as Record<string, string>)
					.filter(([_, cmd]) => cmd.startsWith('$'))
					.map(([alias, cmd]) => `${alias}|${cmd.replace('$', '').trim().replaceAll(' ', '_')}`)
					.join(' ')
				: '',
			MMHB_DEFAULT_PYTHON_VERSION: this.props.defaultPythonVersion!,
		};
		if (this.groups.install.includes('net')) {
			env.MMHB_HOSTS = getHostGroup('all-devices').map(h => `${h.name}|${h.ip}|${h.username}`).join(' ');
		}

		return env;
	}
	get sudoers() {
		const cmds = [
			`/usr/bin/mkdir -p ${this.workDir}`,
			`/usr/bin/mv * ${this.workDir}`,
			`/usr/bin/chown -R ${this.host.username}:${this.host.username} ${this.workDir}`,
			`/usr/bin/rm -rf ${this.workDir}`,
			'/usr/bin/find /usr/local/bin/ -xtype l -delete',
		];

		cmds.push(`/usr/bin/rm -f ${this.workDir}/apps/*`);
		for (const app of this.bins.all) {
			cmds.push(`/usr/bin/rm -f /usr/local/bin/${app}`);
			cmds.push(`/usr/bin/ln -s ${this.workDir}/apps/${app} /usr/local/bin/${app}`);
			cmds.push(`/usr/local/bin/${app} *`);
		}
		cmds.push(`/usr/bin/ln -s ${this.workDir}/bin/homebin /usr/local/bin/${CMD}`);
		cmds.push(`/usr/local/bin/${CMD} *`);
		for (const alias of Object.keys(this.props.aliases || {})) {
			cmds.push(`/usr/bin/rm -f /usr/local/bin/${alias}`);
			cmds.push(`/usr/bin/ln -s ${this.workDir}/aliases/${alias} /usr/local/bin/${alias}`);
			cmds.push(`/usr/local/bin/${alias} *`);
		}

		for (const line of this.groups.install.flatMap(g => GROUP_SUDOERS[g as keyof typeof GROUP_SUDOERS] || [])) {
			cmds.push(line);
		}

		return cmds;
	}

	@hook('install.end')
	@hook('uninstall.end')
	async removeBrokenSymlinks() {
		await this.cmd(`sudo find /usr/local/bin/ -xtype l -delete`);
	}

	@(action('install').filter(['build', 'build-clean']))
	async install() {
		await Promise.all(this.bins.exclude.map(n => this.cmd(`rm -rf ${this.workDir}/apps/${n}`)));
		await Promise.all(this.groups.exclude.map(n => this.cmd(`rm -rf ${this.workDir}/bin/${n}`)));
		await this.rsyncUp({
			excludes: ['bin', 'apps'],
		});
		await this.rsyncUp({
			localSubPath: 'bin',
			excludes: this.groups.exclude,
			preserveSymlinks: true,
		});
		await this.rsyncUp({
			localSubPath: 'apps',
			excludes: this.bins.exclude,
		});
		await this.removeBrokenSymlinks();

		await Promise.all(this.rcFilePaths.map(p => this.configRemove(p)));
		await Promise.all(this.rcFilePaths.map(p => this.configAppend(p, [
			`source ${this.workDir}/bin/.completion.sh`,
		])));
		await this.cmd(`sudo ln -s ${this.workDir}/bin/homebin /usr/local/bin/${CMD}`, {
			noFail: true,
			silent: true,
		});
		for (const app of this.bins.install) {
			await this.cmd(`sudo ln -s ${this.workDir}/apps/${app} /usr/local/bin/${app}`, {
				noFail: true,
				silent: true,
			});
		}

		await this.cmd(`mkdir -p ${this.workDir}/aliases`);
		for (const [alias, cmd] of Object.entries(this.props.aliases || {})) {
			const contents = [
				`#!/bin/bash`,
				`${cmd.replace('$', CMD)} "$@"`,
			].join('\n');
			await this.write(`aliases/${alias}`, contents, {
				permissions: '+x',
			});
			await this.cmd(`sudo ln -s ${this.workDir}/aliases/${alias} /usr/local/bin/${alias}`);
		}

		if (this.groups.install.includes('rpi')) {
			await this.write('bin/rpi/wifi-template.yaml', RPI_WIFI_DEFAULTS);
		}
	}

	@hook('install.begin', t => t.flagsIncludeExplicit(['build', 'build-clean']))
	async buildPackages() {
		if (!this.groups.install.includes('sys')) {
			return;
		}
		const flags = this.flagsInclude('build-clean') ? '--clean' : '';
		await this.localCmd(`${this.localDir}/pkg/monnom/build.sh`, [flags]);
	}

	@action('uninstall')
	async uninstall() {
		await this.cmd(`sudo rm -rf ${this.workDir}`);
		await Promise.all(this.rcFilePaths.map(p => this.configRemove(p)));
	}

	@action('debug')
	async debugConfig() {
		await Promise.all(this.rcFilePaths.map(p => this.configPrint(p)));
		await this.cmd(`cat ${this.workDir}/.env`);
	}
});

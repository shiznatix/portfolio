import { IsNever, Simplify } from 'type-fest';
import chalk from 'chalk';
import { Constructor, StrictProps } from '../../types';
import { HostServiceBuilder, InferPorts, IService } from './service-types';
import { InferMixins } from './mixins';
import { CCommon, Config } from './configs';
import makeService from './service';
import consts from '../../consts';

// Type for service factory args that includes name and props, with config spread at top level:
// - name is required and preserved as a literal type
// - config properties are spread directly (not nested)
// - props contains default values for P
// - If P doesn't have ports, props is fully optional
// - If P has ports, ports property is required with all port fields filled
type ServiceFactoryArgs<P, N extends string, C> = {
	name: N;
} & ExtractConfig<C> & (IsNever<InferPorts<P>> extends true
	? { props?: Partial<P> }
	: { props?: Omit<Partial<P>, 'ports'> } & { ports: Required<InferPorts<P>> });

// Extract config from args by removing known properties
type ExtractConfig<Args> = Omit<Args, 'name' | 'props' | 'ports'>;

type CInfer<C extends CCommon.AllOpt, S extends Config.Service> = CCommon.Infer<C & S>;

// When P has ports, allow httpPort to be constrained to those port keys
type HttpPortOpt<P> = IsNever<InferPorts<P>> extends true
	? { httpPort?: never }
	: { httpPort?: keyof InferPorts<P> };

type Extender<
	P,
	N extends string,
	C extends Config.ServiceOpt,
	R = HostServiceBuilder<P, N>,
	SBase = IService<P, N>,
	Mixins = InferMixins<C>,
> = <
	TExtend extends (
		Base: Constructor<C & SBase & Mixins>
	) => Constructor<C & SBase>
>(extend?: TExtend) => R;

type StackBuilderChain<P, N extends string, C> = {
	sysd: <K extends string, CChild extends Config.SysdOpt & HttpPortOpt<P> & { workSubDir?: string }>(
		key: K, c?: CChild,
	) => Extender<P, K, Simplify<CCommon.Infer<C & CChild> & Config.Sysd>, StackBuilderChain<P, N, C>>;
	docker: <K extends string, CChild extends Config.DockerOpt & HttpPortOpt<P>>(
		key: K, c?: CChild,
	) => Extender<P, K, Simplify<CCommon.Infer<C & CChild> & Config.Docker>, StackBuilderChain<P, N, C>>;
	desktop: <K extends string, CChild extends Config.DesktopOpt & HttpPortOpt<P>>(
		key: K, c?: CChild,
	) => Extender<P, K, Simplify<CCommon.Infer<C & CChild> & Config.Desktop>, StackBuilderChain<P, N, C>>;
	build: <CBuild extends Config.StackOpt>(
		c?: CBuild,
	) => Extender<P, N, C & CBuild & Config.Stack>;
};

const configCommon = <R>(name: string, c?: CCommon.AllOpt) => {
	const defaultWorkDir = `${consts.workDirBase}/${name}`;
	const config = { ...c };

	config.logConfig = config.logConfig ?? { name };

	if (config.isDirMaster) {
		config.isInstallDir = true;
		config.isWorkDir = true;
		config.isLocalDir = true;
	}

	config.isInstallDir = config.isInstallDir ?? config.installDir ? true : config.isInstallDir;
	if (config.isInstallDir) {
		config.installDir = config.installDir || defaultWorkDir;
		config.installDirDelete = config.installDirDelete ?? true;
		config.workDir = config.workDir || config.installDir;
	}

	config.isWorkDir = config.isWorkDir ?? config.workDir ? true : config.isWorkDir;
	if (config.isWorkDir) {
		config.workDir = config.workDir || defaultWorkDir;
	}

	config.isLocalDir = config.isLocalDir ?? config.localDir ? true : config.isLocalDir;
	if (config.isLocalDir) {
		config.localDir = config.localDir || `${consts.localDirBase}/${name}`;
	}

	if (config.isNpm) {
		config.npmLocalSrcDir = config.npmLocalSrcDir || config.localDir;
		config.npmLocalBuildDir = config.npmLocalBuildDir || `${config.localDir}/public`;
	}

	return config as R;
};

// Helper types to allow partial type application (P only) while inferring N and C from values
type NakedServiceFn = <P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.NakedOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.NakedOpt>>) => Extender<P, Args['name'], CInfer<ExtractConfig<Args>, Config.Naked>>;

type DesktopServiceFn = <P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.DesktopOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.DesktopOpt>>) => Extender<P, Args['name'], CInfer<ExtractConfig<Args>, Config.Desktop>>;

type DockerServiceFn = <P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.DockerOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.DockerOpt>>) => Extender<P, Args['name'], CInfer<ExtractConfig<Args>, Config.Docker>>;

type SysdServiceFn = <P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.SysdOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.SysdOpt>>) => Extender<P, Args['name'], CInfer<ExtractConfig<Args>, Config.Sysd>>;

type StackServiceFn = <P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.NakedOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.NakedOpt>>) => StackBuilderChain<P, Args['name'], ExtractConfig<Args>>;

type SysdTimerServiceFn = <P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.StackOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.StackOpt>>) => Extender<P, Args['name'], Config.Sysd>;

export const nakedService = (<P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.NakedOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.NakedOpt>>): Extender<P, Args['name'], CInfer<ExtractConfig<Args>, Config.Naked>> => (extend) => {
	const { name, props, ports, ...config } = args as any;
	const defProps = { ...props, ports };
	const cnf = configCommon<CInfer<ExtractConfig<Args>, Config.Naked>>(name, config);
	return makeService<P, string, CInfer<ExtractConfig<Args>, Config.Naked>>(name, cnf, defProps as Partial<P>, extend);
}) as NakedServiceFn;

export const desktopService = (<P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.DesktopOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.DesktopOpt>>): Extender<P, Args['name'], CInfer<ExtractConfig<Args>, Config.Desktop>> => (extend) => {
	const { name, props, ports, ...config } = args as any;
	const defProps = { ...props, ports };
	const cnf = configCommon<CInfer<ExtractConfig<Args>, Config.Desktop>>(name, {
		workDir: `/home/$USER/.local/share/applications`,
		...config,
	});

	cnf.kind = 'desktop';
	cnf.unitName = cnf.unitName || name;
	cnf.unitFileName = cnf.unitFileName || `${name}.desktop`;
	cnf.unitFilePath = cnf.unitFilePath || `/home/$USER/.local/share/applications/${cnf.unitFileName}`;
	cnf.debugFiles = [
		...(cnf.debugFiles || []),
		cnf.unitFileName,
	];
	cnf.isAutoStart = cnf.isAutoStart ?? !!cnf.autoStartDir;
	cnf.autoStartDir = cnf.autoStartDir ?? cnf.isAutoStart ? '/home/$USER/.config/autostart' : cnf.autoStartDir;

	return makeService<P, string, CInfer<ExtractConfig<Args>, Config.Desktop>>(name, cnf, defProps as Partial<P>, extend);
}) as DesktopServiceFn;

export const dockerService = (<P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.DockerOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.DockerOpt>>): Extender<P, Args['name'], CInfer<ExtractConfig<Args>, Config.Docker>> => (extend) => {
	const { name, props, ports, ...config } = args as any;
	const defProps = { ...props, ports };
	const cnf = configCommon<CInfer<ExtractConfig<Args>, Config.Docker>>(name, {
		isDirMaster: true,
		installDirDelete: 'prompt',
		...config,
	});

	cnf.kind = 'docker';
	cnf.debugFiles = [
		...(cnf.debugFiles || []),
		'.env',
		'docker-compose.yml',
	].filter(Boolean) as string[];

	return makeService<P, string, CInfer<ExtractConfig<Args>, Config.Docker>>(name, cnf, defProps as Partial<P>, extend);
}) as DockerServiceFn;

export const sysdService = (<P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.SysdOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.SysdOpt>>): Extender<P, Args['name'], CInfer<ExtractConfig<Args>, Config.Sysd>> => (extend) => {
	const { name, props, ports, ...config } = args as any;
	const defProps = { ...props, ports };
	const cnf = configCommon<CInfer<ExtractConfig<Args>, Config.Sysd>>(name, config);

	cnf.kind = 'sysd';

	if (cnf.serviceTemplate === 'client') {
		cnf.unitFileTemplate = cnf.unitFileTemplate || 'client';
		cnf.rsyncUpIncludes = cnf.rsyncUpIncludes || ['public'];
		// don't replace the `config.js` so we don't require restarts every sync
		cnf.rsyncUpProtects = cnf.rsyncUpProtects || ['config.js'];
		cnf.httpPort = cnf.httpPort || 'client';
		cnf.unitOwnedPorts = cnf.unitOwnedPorts || ['client'];
	} else if (cnf.serviceTemplate === 'server') {
		cnf.unitFileTemplate = cnf.unitFileTemplate || 'service';
		cnf.httpPort = cnf.httpPort || 'server';
		cnf.unitOwnedPorts = cnf.unitOwnedPorts || Object.keys(ports || {}).filter(k => k !== 'client');
	} else if (cnf.serviceTemplate === 'service') {
		cnf.unitFileTemplate = cnf.unitFileTemplate || 'service';
	}

	cnf.unitInstallable = cnf.unitInstallable ?? true;
	cnf.unitName = cnf.unitName || name;
	cnf.unitType = cnf.unitType || 'service';
	cnf.unitOwner = cnf.unitOwner || 'system';
	cnf.unitFileName = cnf.unitFileName || `${cnf.unitName}.${cnf.unitType}`;
	cnf.unitFilePath = cnf.unitFilePath
		? cnf.unitFilePath
		: cnf.unitOwner === 'system'
			? `/lib/systemd/system/${cnf.unitFileName}`
			: `/etc/systemd/user/${cnf.unitFileName}`;
	cnf.unitSrcFilePath = !cnf.unitSrcFilePath && cnf.workDir
		? `${cnf.workDir}/${cnf.unitFileName}`
		: cnf.unitSrcFilePath;
	cnf.unitFileReplacements = !cnf.unitFileReplacements && cnf.unitSrcFilePath
		? true
		: cnf.unitFileReplacements;
	cnf.unitOwnedPorts = cnf.unitOwnedPorts ?? (ports && Object.keys(ports));
	cnf.restartOnSync = cnf.restartOnSync || 'always';

	const debugFiles = [
		cnf.unitSrcFilePath && cnf.unitFileName,
		cnf.configEnv && '.env',
		cnf.configJson && 'config.json',
		...(cnf.debugFiles || []),
	].filter(Boolean) as string[];
	cnf.debugFiles = debugFiles.length > 0 ? debugFiles : cnf.debugFiles;

	const sudoers = [
		...(cnf.sudoers || []),
		cnf.unitOwner === 'system' && `/usr/bin/systemctl * ${cnf.unitFileName}`,
		`/usr/bin/rm -f /etc/systemd/system/${cnf.unitFileName}`,
		`/usr/bin/rm -f /etc/systemd/system/multi-user.target.wants/${cnf.unitFileName}`,
		`/usr/bin/rm -f /etc/systemd/system/default.target.wants/${cnf.unitFileName}`,
		`/usr/bin/rm -f /usr/lib/systemd/system/${cnf.unitFileName}`,
	].filter(Boolean) as string[];
	cnf.sudoers = sudoers.length > 0 ? sudoers : cnf.sudoers;

	return makeService<P, string, CInfer<ExtractConfig<Args>, Config.Sysd>>(name, cnf, defProps as Partial<P>, extend);
}) as SysdServiceFn;

// Helper type to allow partial type application (P only) while inferring N and C
type PythonServiceFn = <P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.SysdOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.SysdOpt>>) => Extender<P, Args['name'], CInfer<ExtractConfig<Args>, Config.Sysd>>;

export const pythonService = (<P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.SysdOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.SysdOpt>>): Extender<P, Args['name'], CInfer<ExtractConfig<Args>, Config.Sysd>> => {
	const { name, props, ports, ...config } = args as any;
	return sysdService<P>()({
		name,
		isDirMaster: true,
		isDev: true,
		isPython: true,
		...config,
		props,
		ports,
	} as any);
}) as PythonServiceFn;

/* STACK SERVICES */
const stackColors = [
	[chalk.blue, chalk.blueBright, chalk.bgRgb(50, 50, 120)],
	[chalk.cyan, chalk.cyanBright, chalk.bgRgb(50, 120, 120)],
	[chalk.yellow, chalk.yellowBright, chalk.bgRgb(120, 120, 50)],
	[chalk.magenta, chalk.magentaBright, chalk.bgRgb(120, 50, 120)],
	[chalk.green, chalk.greenBright, chalk.bgRgb(50, 120, 50)],
	[chalk.white, chalk.whiteBright, chalk.bgRgb(120, 120, 120)],
];

export const stackService = (<P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.NakedOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.NakedOpt>>): StackBuilderChain<P, Args['name'], ExtractConfig<Args>> => {
	const { name, props, ports, ...config } = args as any;
	const defProps = { props, ports };
	const baseConfig = configCommon<ExtractConfig<Args>>(name, config);
	const children: Config.Stack['children'] = {};
	let colorIndex = 0;
	const nextColors = () => {
		const colors = stackColors[colorIndex % stackColors.length];
		colorIndex++;
		return colors;
	}
	const mergeConfigs = (childName: string, c: any) => {
		const [style1, style2, styleBg] = nextColors();
		return {
			...baseConfig,
			...(c?.serviceTemplate ? {
				workDir: baseConfig.workDir && `${baseConfig.workDir}/${c?.workSubDir || c?.serviceTemplate}`,
				installDir: baseConfig.installDir && `${baseConfig.installDir}/${c?.workSubDir || c?.serviceTemplate}`,
				localDir: baseConfig.localDir && `${baseConfig.localDir}/${c?.workSubDir || c?.serviceTemplate}`,
			} : {}),
			...c,
			logConfig: {
				...baseConfig?.logConfig,
				name: childName,
				style1,
				style2,
				styleBg,
				...c?.logConfig,
			},
		};
	};

	const builder = {
		sysd: (key, c) => (extend) => {
			const s = sysdService<P>()({
				name: key,
				journalOpts: {
					postCommand: `sed -u "s/^/${key}: /"`,
				},
				...mergeConfigs(key, c),
				...defProps,
			} as any)(extend as any);
			children[key] = s;
			return builder;
		},
		docker: (key, c) => (extend) => {
			const s = dockerService<P>()({
				name: key,
				...mergeConfigs(key, c),
				...defProps,
			} as any)(extend as any);
			children[key] = s;
			return builder;
		},
		desktop: (key, c) => (extend) => {
			const s = desktopService<P>()({
				name: key,
				...mergeConfigs(key, c),
				...defProps,
			} as any)(extend as any);
			children[key] = s;
			return builder;
		},
		build: (c) => (extend) => {
			const cnf = configCommon<Config.StackOpt>(name, {
				...c,
			});

			cnf.kind = 'stack';
			cnf.stackName = name;
			cnf.children = children;
			const finalDefProps = { ...props, ports };
			return makeService<P, string, Config.Stack>(name, cnf as Config.Stack, finalDefProps as Partial<P>, extend);
		},
	} as StackBuilderChain<P, string, ExtractConfig<Args>>;

	return builder;
}) as StackServiceFn;

export const sysdTimerService = (<P>() => <
	const Args extends ServiceFactoryArgs<P, string, Config.StackOpt>
>(args: Args & StrictProps<Args, ServiceFactoryArgs<P, Args['name'], Config.StackOpt>>) => (extend?: any) => {
	const { name, props, ports, ...config } = args as any;
	const stackCnf = configCommon<Config.StackOpt>(name, {
		isDirMaster: true,
		...config,
	});
	const baseCnf = {
		isWorkDir: true,
	} as Config.NakedOpt;

	return stackService<P>()({
		name,
		...baseCnf,
		props,
		ports,
	} as any)
		.sysd('service', {
			unitName: name,
			unitDescription: `${name} service`,
			unitType: 'service',
			unitFileTemplate: 'timer-target',
			unitInstallable: false,
			logConfig: { name: '.service' },
		})(extend)
		.sysd('timer', {
			unitName: name,
			unitDescription: `${name} timer`,
			unitType: 'timer',
			unitFileTemplate: 'timer',
			unitInstallable: true,
			logConfig: { name: '.timer' },
		})(extend)
		.build(stackCnf)();
}) as SysdTimerServiceFn;


import { Static, Type } from '@sinclair/typebox';
import { ChalkInstance } from 'chalk';
import { Simplify } from 'type-fest';
import { HostServiceBuilder } from './service-types';
import { MixinName } from './mixins';

export namespace CCommon {
	// **** Global ****/
	export const Log = Type.Object({
		indent: Type.Optional(Type.Number()),
		name: Type.Optional(Type.String()),
		style1: Type.Optional(Type.Any()),
		style2: Type.Optional(Type.Any()),
		styleBg: Type.Optional(Type.Any()),
		noSymbol: Type.Optional(Type.Boolean()),
		verbose: Type.Optional(Type.Boolean()),
	});
	export type Log = Static<typeof Log> & {
		style1?: ChalkInstance;
		style2?: ChalkInstance;
		styleBg?: ChalkInstance;
	};
	// ----
	export const LogConfig = Type.Object({
		logConfig: Type.Optional(Log),
	});
	export type LogConfig = {
		logConfig?: Log;
	};

	// **** Service Templates ****/
	export const ServiceTemplate = Type.Object({
		serviceTemplate: Type.Optional(Type.Union([
			Type.Literal('client'),
			Type.Literal('server'),
			Type.Literal('service'),
		])),
	});
	export type ServiceTemplate = Static<typeof ServiceTemplate>;

	// **** Dir Management ****/
	export const DirMaster = Type.Object({
		isDirMaster: Type.Literal(true),
	});
	export type DirMaster = Static<typeof DirMaster>;
	// ----
	export const WorkDir = Type.Object({
		isWorkDir: Type.Literal(true),
		workDir: Type.String(),
	});
	export type WorkDir = Static<typeof WorkDir>;
	// ----
	export const InstallDir = Type.Object({
		isInstallDir: Type.Literal(true),
		installDir: Type.String(),
		installSubDirs: Type.Optional(Type.Array(Type.String())),
		installDirDelete: Type.Optional(
			Type.Union([
				Type.Literal(true),
				Type.Literal('prompt'),
			])
		),
	});
	export type InstallDir = Static<typeof InstallDir>;
	// ----
	export const LocalDir = Type.Object({
		isLocalDir: Type.Literal(true),
		localDir: Type.String(),
	});
	export type LocalDir = Static<typeof LocalDir>;
	// ----
	export const RSync = Type.Object({
		rsyncUpIncludes: Type.Optional(Type.Array(Type.String())),
		rsyncUpExcludes: Type.Optional(Type.Array(Type.String())),
		rsyncUpProtects: Type.Optional(Type.Array(Type.String())),
		// rsyncDownIncludes: Type.Optional(Type.Array(Type.String())),
		rsyncDownExcludes: Type.Optional(Type.Array(Type.String())),
	});
	export type RSync = Static<typeof RSync>;

	// **** Config Files ****/
	export const ConfigJson = Type.Object({
		configJson: Type.Union([
			Type.Literal(true),
			Type.Record(Type.String(), Type.Any()),
		]),
		configJsonFileName: Type.Optional(Type.String()),
		configJsonDir: Type.Optional(Type.String()),
	});
	export type ConfigJson = Static<typeof ConfigJson>;
	// ----
	export const ConfigEnv = Type.Object({
		configEnv: Type.Record(Type.String(), Type.Union([
			Type.String(), Type.Number(),
		])),
		configEnvDir: Type.Optional(Type.String()),
	});
	export type ConfigEnv = Static<typeof ConfigEnv>;
	// ----
	export const DebugFiles = Type.Object({
		debugFiles: Type.Array(
			Type.Union([
				Type.String(),
				Type.Object({
					path: Type.String(),
					sudo: Type.Boolean(),
				}),
			]),
		),
	});
	export type DebugFiles = Static<typeof DebugFiles>;
	// ----
	export const Sudoers = Type.Object({
		sudoers: Type.Array(Type.String()),
	});
	export type Sudoers = Static<typeof Sudoers>;

	// **** Dependencies ****/
	export const AptDeps = Type.Object({
		aptDependencies: Type.Array(Type.String()),
		aptDepencenciesFlags: Type.Optional(
			Type.Object({
				reinstall: Type.Optional(Type.Boolean()),
			})
		),
	});
	export type AptDeps = Static<typeof AptDeps>;
	// ----
	export const SnapDeps = Type.Object({
		snapDependencies: Type.Array(Type.String()),
		snapDependenciesFlags: Type.Optional(
			Type.Object({
				classic: Type.Optional(Type.Boolean()),
			})
		),
	});
	export type SnapDeps = Static<typeof SnapDeps>;
	// ----
	export const Python = Type.Object({
		isPython: Type.Literal(true),
		pythonExtraPackages: Type.Optional(Type.Array(Type.String())),
		pythonSystemSitePackages: Type.Optional(Type.Boolean()),
	});
	export type Python = Static<typeof Python>;
	// ----
	export const Pi = Type.Object({
		piInterfaces: Type.Array(
			Type.Union([
				Type.String(),
				Type.Tuple([
					Type.String(),
					Type.Union([Type.String(), Type.Boolean()]),
				]),
			]),
		),
	});
	export type Pi = Static<typeof Pi>;
	// ----
	export const Npm = Type.Object({
		isNpm: Type.Literal(true),
		npmLocalSrcDir: Type.String(),
		npmLocalBuildDir: Type.String(),
	});
	export type Npm = Static<typeof Npm>;

	// **** Dev Mode ****/
	export const Dev = Type.Object({
		isDev: Type.Literal(true),
		devCheckPath: Type.Optional(Type.Function(
			[Type.String()], Type.Boolean(),
		)),
		devOnChange: Type.Optional(Type.Function(
			[Type.Array(Type.String())], Type.Promise(Type.Void()),
		)),
		devStartProcess: Type.Optional(Type.Function(
			[], Type.Promise(Type.Void()),
		)),
	});
	export type Dev = Static<typeof Dev>;
	// ****

	// **** HTTP Port Mapping ****/
	export const HttpPort = Type.Object({
		httpPort: Type.String(),
	});
	export type HttpPort = Static<typeof HttpPort>;
	// ****

	export type All =
		LogConfig & ServiceTemplate
		& DirMaster & InstallDir & LocalDir & WorkDir & RSync
		& ConfigJson & ConfigEnv & DebugFiles & Sudoers
		& AptDeps & SnapDeps & Python & Pi
		& Dev & Npm & HttpPort;
	export type AllOpt = Partial<All>;

	export type Infer<C> =
		C &
		LogConfig &
		(C extends DirMaster ? InstallDir & WorkDir & LocalDir : {}) &
		(C extends { isInstallDir: true } ? InstallDir & WorkDir :
			C extends { installDir: string } ? InstallDir & WorkDir : {}) &
		(C extends { isWorkDir: true } ? WorkDir :
			C extends WorkDir ? WorkDir : {}) &
		(C extends { isLocalDir: true } ? LocalDir :
			C extends { localDir: string } ? LocalDir : {});
}

export namespace CMixins {
	export type Mode = 'no-hooks' | 'no-actions' | 'no-triggers' | true;

	export type All = {
		[K in MixinName as `mixin${Capitalize<K>}`]?: Mode;
	} & {
		[K in Exclude<string, keyof { [P in MixinName as `mixin${Capitalize<P>}`]: any }> as K extends `mixin${string}` ? K : never]?: never;
	};
}

export namespace CServiceCommon {
	export const UnitFile = Type.Object({
		unitName: Type.String(),
		unitDescription: Type.Optional(Type.String()),
		unitStartAfter: Type.Optional(Type.String()),
		unitExecSudo: Type.Optional(Type.Boolean()),
		unitExecStartPre: Type.Optional(Type.String()),
		unitExecStart: Type.Optional(Type.String()),
		unitExecStartPost: Type.Optional(Type.String()),
		unitEnvironment: Type.Optional(Type.Record(Type.String(), Type.Union([
			Type.String(), Type.Number(),
		]))),
		unitTimerOnBootSec: Type.Optional(Type.Number()),
		unitTimerOnUnitActiveSec: Type.Optional(Type.Number()),
		unitFileName: Type.String(),
		unitFilePath: Type.String(),
		unitSrcFilePath: Type.Optional(Type.String()),
		unitFileReplacements: Type.Optional(
			Type.Union([
				Type.Literal(true),
				Type.Record(Type.String(), Type.Union([
					Type.String(), Type.Number(),
				])),
			])
		),
		unitFileTemplate: Type.Optional(Type.Union([
			Type.Literal('client'),
			Type.Literal('service'),
			Type.Literal('timer'),
			Type.Literal('timer-target'),
			Type.String(),
		])),
		unitOwnedPorts: Type.Optional(Type.Array(Type.String())),
	});
}

export namespace CService {
	export const Desktop = Type.Composite([
		Type.Object({
			kind: Type.Literal('desktop'),
			isAutoStart: Type.Boolean(),
			autoStartDir: Type.Optional(Type.String()),
		}),
		CServiceCommon.UnitFile,
		Type.Object({
			unitFileTemplate: Type.String(),
		}),
	]);
	export type Desktop = Static<typeof Desktop>;

	export const Docker = Type.Object({
		kind: Type.Literal('docker'),
		dockerComposeFile: Type.Optional(Type.String()),
		containerNames: Type.Optional(Type.Array(Type.String())),
	});
	export type Docker = Static<typeof Docker>;

	export const Stack = Type.Object({
		kind: Type.Literal('stack'),
		stackName: Type.String(),
		children: Type.Record(Type.String(), Type.Any()),
	});
	export type Stack = Simplify<Omit<Static<typeof Stack>, 'children'> & {
		children: Record<string, HostServiceBuilder<any, string>>;
	}>;

	export const Sysd = Type.Composite([
		Type.Object({
			kind: Type.Literal('sysd'),
			unitOwner: Type.Union([
				Type.Literal('system'),
				Type.Literal('user'),
			]),
			unitType: Type.Union([
				Type.Literal('service'),
				Type.Literal('timer'),
			]),
			unitInstallable: Type.Boolean(),
			journalOpts: Type.Optional(
				Type.Object({
					postfixFlags: Type.Optional(
						Type.Union([
							Type.Array(Type.String()),
							Type.String(),
						])
					),
					postCommand: Type.Optional(Type.String()),
				})
			),
			restartOnSync: Type.Optional(
				Type.Union([
					Type.Literal('always'),
					Type.Literal('never'),
					Type.Literal('if-running'),
				])
			),
		}),
		CServiceCommon.UnitFile,
	]);
	export type Sysd = Static<typeof Sysd>;
}

export namespace Config {
	export type Naked = Partial<CCommon.All> & CMixins.All;
	export type NakedOpt = Partial<Naked>;
	export type Desktop = CService.Desktop & CCommon.WorkDir & Naked;
	export type DesktopOpt = Partial<Desktop>;
	export type Docker = CService.Docker & CCommon.DirMaster & Naked;
	export type DockerOpt = Partial<Docker>;
	export type Stack = CService.Stack & Naked;
	export type StackOpt = Partial<Stack>;
	export type Sysd = CService.Sysd & CCommon.WorkDir & Naked;
	export type SysdOpt = Partial<Sysd>;
	export type Python = CCommon.Python & CService.Sysd & CCommon.DirMaster & Naked;
	export type PythonOpt = Partial<Python>;

	export type Service = Naked | Desktop | Docker | Stack | Sysd | Python;
	export type ServiceOpt = NakedOpt | DesktopOpt | DockerOpt | StackOpt | SysdOpt | PythonOpt;

	export type AllKeys = Simplify<
		keyof CCommon.All
		| keyof CService.Desktop
		| keyof CService.Docker
		| keyof CService.Stack
		| keyof CService.Sysd
	>;
}

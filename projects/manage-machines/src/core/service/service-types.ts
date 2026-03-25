import { IsNever, RequiredDeep } from 'type-fest';
import type Host from '../host/host';
import { CmdOpts, CmdOutput } from '../host/types';
import { LoggerInstance } from '../../logger';
import { ArgvFlags, Constructor } from '../../types';
import { Action, AnnotationType, Flag, HandlerMethod, Hook } from './annotations/types';

export type InferPorts<P> = P extends { ports?: infer Ports }
	? RequiredDeep<Ports>
	: never;

export type ServiceUrlOpts<P> = {
	port?: IsNever<InferPorts<P>> extends true ? never : keyof InferPorts<P>;
	path?: string;
	protocol?: string;
	password?: string;
};

export type HostServiceBuilder<P, N extends string> = {
	(host: Host, props: P, argvFlags: ArgvFlags): Constructor<IService<P, N>>;
	Name: N;
	Props: P;
	BaseConfig: any;
	Service: IService<P, N>;
};

export type TriggerOpts = CmdOpts & {
	disableHooks?: true | 'symboled';
};

export interface IService<P, N extends string = string> {
	name: N;
	props: P;
	host: Host;
	flags: ArgvFlags;
	log: LoggerInstance;

	callStack: string[];
	initiatingAction: Action | null;

	hasProps(): boolean;

	cmd(cmd: string, opts?: CmdOpts): Promise<CmdOutput>;
	localCmd(cmd: string, args?: string[], opts?: CmdOpts): Promise<CmdOutput>;

	allActionNames(): Action[];
	actionNames(): Action[];
	actionManagerNames(): Action[];
	hookNames(): Hook[];
	flagNames(action: Action): Flag[];
	flagOpts(action: Action, flag: Flag): true | string[];
	flagsWithOpts(action: Action): Partial<Record<Flag, true | string[]>>;

	triggerHandlers(annotType: 'actionManager', name: Action): HandlerMethod[];
	triggerHandlers(annotType: 'action', name: Action): HandlerMethod[];
	triggerHandlers(annotType: 'hook', name: Hook): HandlerMethod[];

	trigger(annotType: AnnotationType, name: Action | Hook, fns: HandlerMethod[], opts?: TriggerOpts): Promise<void>;
	triggerAction(action: Action, opts?: TriggerOpts): Promise<void>;
	triggerHook(hook: Hook, opts?: TriggerOpts): Promise<void>;
	clearTriggerCache(): void;
	startAction(action: Action, opts?: TriggerOpts & { noPrompt?: boolean }): Promise<void>;

	port(portName: IsNever<InferPorts<P>> extends true ? never : keyof InferPorts<P>): number;
	ports(this: IsNever<InferPorts<P>> extends true ? never : this): InferPorts<P>;
	url(portOrOpts?: (IsNever<InferPorts<P>> extends true ? never : keyof InferPorts<P>) | ServiceUrlOpts<P>, opts?: ServiceUrlOpts<P>): string;
}
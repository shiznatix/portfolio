import { HostKey } from './inventory/hosts';
import { ServiceName } from './inventory/services';
import { Action, FlagBoolean, FlagString, FlagNumber, FlagFilterable } from './core/service/annotations/types';
import { Simplify } from 'type-fest';

export type Constructor<T = {}> = (new (...args: any[]) => T);
export type FunctionsOnly<T> = {
	[K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K]
};
export type StrictProps<T, U> = T & Record<Exclude<keyof T, keyof U>, never>;

export type ArgvPositional = {
	hosts: HostKey[];
	services: ServiceName[];
	actions: Action[];
};

export type ArgvFlags = Simplify<
	Record<FlagBoolean, boolean> &
	Record<FlagString, string | null> &
	Record<FlagNumber, number | null> &
	Record<FlagFilterable, string[]>
>;

export type Argv = ArgvPositional & ArgvFlags;

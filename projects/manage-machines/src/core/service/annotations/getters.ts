import { Hook, Action, Flag } from './types';
import { getMetadata, getFromMetadataMap } from './metadata';
import { ArgvFlags } from '../../../types';

type WithFlags = { flags: ArgvFlags };

function filterMethod(inst: WithFlags, method: string | symbol): boolean {
	const meta = getMetadata(inst);
	if (!meta) {
		return true;
	}

	const methodFilters = meta.methodFilters.get(method);
	if (!methodFilters) {
		return true;
	}

	const required = methodFilters.get('required');
	const optional = methodFilters.get('optional');

	if (required && required.size > 0) {
		const hasRequired = [...required].some(val => inst.flags.include.includes(val));
		if (!hasRequired) {
			return false;
		}
	}

	if (optional && optional.size > 0) {
		const hasSkip = [...optional].some(val => inst.flags.skip.includes(val));
		const inIncludes = inst.flags.include.length > 0
			? [...optional].some(val => inst.flags.include.includes(val))
			: true;
		if (hasSkip || !inIncludes) {
			return false;
		}
	}

	return true;
}

export function actionNames(inst: WithFlags) {
	const meta = getMetadata(inst);
	return [...(meta?.actions.keys() || [])] as Action[];
}

export function actionManagerNames(inst: WithFlags) {
	const meta = getMetadata(inst);
	return [...(meta?.actionManagers.keys() || [])] as Action[];
}

export function hookNames(inst: WithFlags) {
	const meta = getMetadata(inst);
	return [...(meta?.hooks.keys() || [])] as Hook[];
}

export function flagNames(inst: WithFlags, action: Action) {
	const meta = getMetadata(inst);
	return [...(meta?.flags.get(action)?.keys() || [])] as Flag[];
}

export function flagOpts(inst: WithFlags, action: Action, flag: Flag) {
	const meta = getMetadata(inst);
	const value = meta?.flags.get(action)?.get(flag);
	if (value instanceof Set) {
		return [...value] as string[];
	}
	return true;
}

export function getActionFuncs(inst: WithFlags, action: Action) {
	return getFromMetadataMap(inst, 'action', action).filter(fn => filterMethod(inst, fn));
}

export function getActionManagerFuncs(inst: WithFlags, action: Action) {
	return getFromMetadataMap(inst, 'actionManager', action);
}

export function getHookFuncs(inst: WithFlags, hook: Hook) {
	return getFromMetadataMap(inst, 'hook', hook);
}

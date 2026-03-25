import chalk from 'chalk';
import { CmdOpts } from '../host/types';
import { LoggerInstance } from '../../logger';
import { arrayUnique, ucfirst } from '../../utils';
import * as annotations from './annotations';
import { Action, AnnotationType, Flag, FlagsOpts, HandlerMethod, Hook } from './annotations/types';
import { ArgvFlags } from '../../types';
import { TriggerOpts } from './service-types';

type RunTriggers<T extends Action | Hook> = Partial<Record<T, boolean>>;

export default abstract class ServiceTriggers {
	abstract flags: ArgvFlags;
	abstract log: LoggerInstance;
	callStack: string[] = [];
	initiatingAction: Action | null = null;

	private _runActionMgrs: RunTriggers<Action> = {};
	private _runActions: RunTriggers<Action> = {};
	private _runHooks: RunTriggers<Hook> = {};

	allActionNames(): Action[] {
		return arrayUnique([
			...this.actionNames(),
			...this.actionManagerNames(),
		]);
	}
	actionNames(): Action[] {
		return annotations.actionNames(this);
	}
	actionManagerNames(): Action[] {
		return annotations.actionManagerNames(this);
	}
	hookNames(): Hook[] {
		return annotations.hookNames(this);
	}
	flagNames(action: Action) {
		return annotations.flagNames(this, action);
	}
	flagOpts(action: Action, flag: Flag) {
		return annotations.flagOpts(this, action, flag);
	}
	flagsWithOpts(action: Action) {
		const flags = this.flagNames(action);
		return flags.reduce((acc, curr) => {
			const flag = curr as Flag;
			acc[flag] = this.flagOpts(action, flag as Flag)
			return acc;
		}, {} as FlagsOpts);
	}

	triggerHandlers(annotType: 'actionManager', name: Action, noSymbols?: boolean): HandlerMethod[];
	triggerHandlers(annotType: 'action', name: Action, noSymbols?: boolean): HandlerMethod[];
	triggerHandlers(annotType: 'hook', name: Hook, noSymbols?: boolean): HandlerMethod[];
	triggerHandlers(annotType: AnnotationType, name: Action | Hook, noSymbols?: boolean) {
		const funcs = [];
		if (annotType === 'actionManager') {
			funcs.push(...annotations.getActionManagerFuncs(this, name as Action));
		} else if (annotType === 'action') {
			funcs.push(...annotations.getActionFuncs(this, name as Action));
		} else {
			funcs.push(...annotations.getHookFuncs(this, name as Hook));
		}

		const reversed = funcs.filter(f => noSymbols ? typeof f !== 'symbol' : true).reverse();
		const nonSymbols = reversed.filter(f => typeof f !== 'symbol');
		const symbols = reversed.filter(f => typeof f === 'symbol');
		return [...nonSymbols, ...symbols];
	}

	// annotation runners
	async trigger(annotType: AnnotationType, name: Action | Hook, fns: HandlerMethod[], opts?: CmdOpts) {
		this.log.verbose(`Triggering ${annotType}: ${name} count: ${fns.length}`);
		this.callStack.push(`${annotType}:${name}`);
		this.log.inc();

		let i = 1;
		const len = fns.length;
		const logT = ucfirst(annotType);
		for (const fn of fns) {
			this.log(
				chalk.italic.dim(`${logT}.${chalk.bold(name)}`),
				chalk.bold.greenBright('→ '),
				chalk.bold(fn.toString()),
				`(${i}/${len})`,
			);

			// @ts-expect-error
			await this[fn](opts);
			i++;
		}

		this.log.dec();
		this.callStack.pop();
	}

	async triggerAction(action: Action, opts?: TriggerOpts) {
		if (!this._runActionMgrs[action]) {
			this._runActionMgrs[action] = true;

			const managers = this.triggerHandlers('actionManager', action);
			if (managers.length > 0) {
				await this.trigger('actionManager', action, managers, opts);
				return;
			}
		}

		if (this._runActions[action]) {
			this.log.warn(`Action ${chalk.underline(action)} has already been triggered`);
			return;
		}

		this._runActions[action] = true;
		const handlers = this.triggerHandlers('action', action);
		await this.trigger('action', action, handlers, opts);
	}

	async triggerHook(hook: Hook, opts?: TriggerOpts) {
		if (opts?.disableHooks === true) {
			this.log(`Skipping hooks due to noHooks flag: ${hook}`);
			return;
		}
		if (this._runHooks[hook]) {
			this.log.warn(`Hook ${chalk.underline(hook)} has already been triggered`);
			return;
		}

		this._runHooks[hook] = true;
		const handlers = this.triggerHandlers('hook', hook, opts?.disableHooks === 'symboled');
		await this.trigger('hook', hook, handlers, opts);
	}

	clearTriggerCache() {
		this._runActionMgrs = {};
		this._runActions = {};
		this._runHooks = {};
	}

	async startAction(action: Action, opts?: CmdOpts) {
		if (this.initiatingAction) {
			throw new Error(`Cannot start action ${action} while ${this.initiatingAction} is in progress`);
		}

		try {
			this.initiatingAction = action;
			await this.triggerAction(action, opts);
		} finally {
			this.initiatingAction = null;
		}
	}
}

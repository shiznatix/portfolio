import chalk from 'chalk';
import { CService } from '../configs';
import { withMixin } from '../mixin-factory';
import { IService } from '../service-types';
import { arrayUnique, sleep } from '../../../utils';
import { SkippableError } from '../../../errors';
import { CmdOpts } from '../../../core/host/types';
import { Action, AnnotationType, Flag, FlagsOpts, Hook } from '../annotations/types';
import flags from '../common/flags';

const runnerStack = withMixin(
	'runnerStack',
	CService.Stack,
	flags,
)(Base => class extends Base {
	private readonly childInsts = Object.entries(this.children as CService.Stack['children'])
		.reduce((acc, [key, child]) => {
			if (this.stackIncludeChild(key)) {
				acc[key] = new (child(this.host, this.props, this.flags));
			}

			return acc;
		}, {} as Record<string, IService<typeof this.props>>);
	private readonly hasAllChildren = Object.keys(this.children).length === Object.keys(this.childInsts).length;

	private stackIncludeChild(key: string) {
		return this.flags.child.length ? this.flags.child.includes(key) : true;
	}

	override allActionNames(): Action[] {
		const parents = super.allActionNames();
		const childrens = Object.values(this.childInsts)
			.flatMap(c => c.allActionNames());

		return arrayUnique([
			...parents,
			...childrens,
		]);
	}

	override flagsWithOpts(action: Action) {
		const childNames = Object.keys(this.childInsts);
		const arr: FlagsOpts[] = [
			{ child: childNames },
			super.flagsWithOpts(action),
			...Object.values(this.childInsts)
				.flatMap(c => c.flagsWithOpts(action)),
		];

		return arr.reduce((acc, curr) => {
			for (const [k, val] of Object.entries(curr)) {
				const key = k as Flag;

				if (!(k in acc)) {
					acc[key] = val;
				} else if (Array.isArray(acc[key]) && Array.isArray(val)) {
					acc[key] = arrayUnique([...acc[key], ...val]);
				} else if (!Array.isArray(acc[key]) && Array.isArray(val)) {
					acc[key] = val;
				}
			}
			return acc;
		}, {} as FlagsOpts);
	}

	override async trigger(annotType: AnnotationType, name: Action | Hook, fns: (string | symbol)[], opts?: CmdOpts) {
		if (!this.callStack.length) {
			this.log(chalk.greenBright.overline(`Parent trigger ${annotType} -> ${name}`));
		}
		if (this.hasAllChildren) {
			await super.trigger(annotType, name, fns, opts);
		}
		if (this.callStack.length) {
			return;
		}

		const isAction = (annotType === 'actionManager' || annotType === 'action');
		const actionName = isAction ? name as Action : null;
		const isParallel = isAction && (actionName === 'dev' || actionName === 'logs');
		const actionPromises: Promise<void>[] = [];
		const errors: unknown[] = [];

		const handleError = async (promiseOrError: Promise<void> | unknown, who: string) => {
			let error: unknown = promiseOrError instanceof Error ? promiseOrError : null;

			if (!error) {
				try {
					await (promiseOrError as Promise<void>);
				} catch (err) {
					error = err;
				}
			}

			if (error instanceof SkippableError) {
				if (!error.silent) {
					this.log(chalk.yellowBright.overline(`Skipping ${who}: ${error.message}`));
				}
			} else {
				errors.push(error);
				this.log.error(error instanceof Error ? error.message : String(error));
			}
		};

		for (const child of Object.values(this.childInsts)) {
			this.log(chalk.yellowBright.overline(`Child trigger "${child.name}" ${annotType} -> ${name}`));

			if (isAction) {
				const actionRun = child.startAction(name as Action, {
					...opts,
				});
				if (isParallel) {
					actionPromises.push(actionRun);
					await sleep(500); // prevent ssh master-create race
				} else {
					try {
						await actionRun;
					} catch (err) {
						await handleError(err, `child "${child.name}" action`);
					}
				}
			} else if (annotType === 'hook') {
				try {
					await child.triggerHook(name as Hook, opts);
				} catch (err) {
					await handleError(err, `child "${child.name}" hook`);
				}
			}
		}

		if (isParallel) {
			const results = await Promise.allSettled(actionPromises);
			for (const result of results) {
				if (result.status === 'rejected') {
					const err = result.reason;
					await handleError(err, 'parallel child action');
				}
			}
		}

		if (errors.length === 1) {
			throw errors[0];
		} else if (errors.length > 1) {
			throw new AggregateError(errors, `${errors.length} child actions failed`);
		}
	}
});

export default runnerStack;

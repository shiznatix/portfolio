import { Hook, Action, Flag, ServiceMetaKey, ServiceMeta, AnnotationType, MethodFilterMode, HandlerMethod, FlagGeneric } from './types';
import { ensureMetadata, addToMetadataMap } from './metadata';
import MixinMeta from '../mixin-meta';
import { actionNames, getHookFuncs, hookNames } from './getters';
import { CMixins } from '../configs';

type TClass = {};

function createDecorator<This extends TClass = any>(type: AnnotationType, name: ServiceMetaKey | ServiceMetaKey[], condition?: (self: This) => any) {
	const names = Array.isArray(name) ? name : [name];

	return (_target: any, context: ClassMethodDecoratorContext<This>) => {
		const mixinMeta = MixinMeta.get(_target);

		context.addInitializer(function(this: This) {
			if (mixinMeta) {
				const mode = this[mixinMeta.key as keyof This] as CMixins.Mode;
				const skip = mode === 'no-triggers'
					|| (type === 'action' && mode === 'no-actions')
					|| (type === 'hook' && mode === 'no-hooks');
				if (skip) {
					return;
				}
			}

			if (condition && !condition(this)) {
				return;
			}

			const meta = ensureMetadata(this);
			for (const n of names) {
				addToMetadataMap(meta, type, n, context.name);
			}
		});
	};
}

function setFlag(meta: ServiceMeta, action: Action, flag: Flag, value?: string[]) {
	if (!meta.flags.has(action)) {
		meta.flags.set(action, new Map());
	}
	const flags = meta.flags.get(action)!;

	if (value) {
		if (!flags.has(flag)) {
			flags.set(flag, new Set());
		}
		const opts = flags.get(flag)! as Set<string>;
		for (const v of value) {
			opts.add(v);
		}
	} else {
		flags.set(flag, true);
	}
}

function methodFilter(meta: ServiceMeta, method: HandlerMethod, mode: MethodFilterMode, values: string[]) {
	if (!meta.methodFilters.has(method)) {
		meta.methodFilters.set(method, new Map());
	}
	const methodFilters = meta.methodFilters.get(method)!;

	if (!methodFilters.has(mode)) {
		methodFilters.set(mode, new Set());
	}
	const opts = methodFilters.get(mode)! as Set<string>;
	for (const v of values) {
		opts.add(v);
	}
}

export function hook<This extends TClass = any>(name: Hook, condition?: (self: This) => any) {
	return createDecorator<This>('hook', name, condition);
}

const actionFilter = (filterMode?: MethodFilterMode) => <This extends TClass = any>(values: string | string[] | ((self: This) => string[])) => {
	return (_target: any, context: ClassMethodDecoratorContext<This>) => {
		context.addInitializer(function(this: This) {
			const meta = ensureMetadata(this);
			const resolvedValues = typeof values === 'function' ? values(this) : (Array.isArray(values) ? values : [values]);
			if (!resolvedValues?.length) {
				return;
			}

			const actions = meta.actions.entries();
			for (const [action, funcs] of actions) {
				if (funcs.has(context.name)) {
					setFlag(meta, action, 'skip', resolvedValues);
					setFlag(meta, action, 'include', resolvedValues);

					if (filterMode) {
						methodFilter(meta, context.name, filterMode, resolvedValues);
					}
				}
			}
		});
	};
};
const actionFlag = <This extends TClass = any>(flags: FlagGeneric | FlagGeneric[]) => {
	return (_target: any, context: ClassMethodDecoratorContext<This>) => {
		context.addInitializer(function(this: This) {
			const meta = ensureMetadata(this);
			const resolvedFlags = Array.isArray(flags) ? flags : [flags];
			if (!resolvedFlags?.length) {
				return;
			}

			const actions = meta.actions.entries();
			for (const [action, funcs] of actions) {
				if (funcs.has(context.name)) {
					for (const flag of resolvedFlags) {
						setFlag(meta, action, flag);
					}
				}
			}
		});
	};
};

type ActionDecorator<This extends TClass = any> = {
	<T extends This>(target: any, context: ClassMethodDecoratorContext<T>): void;
	required<T extends This>(values: string | string[] | ((self: T) => string[])): ActionDecorator<This>;
	optional<T extends This>(values: string | string[] | ((self: T) => string[])): ActionDecorator<This>;
	filter<T extends This>(values: string | string[] | ((self: T) => string[])): ActionDecorator<This>;
	flag<T extends This>(flags: FlagGeneric | FlagGeneric[]): ActionDecorator<This>;
};

export function action<This extends TClass = any>(name: Action | Action[], condition?: (self: This) => any): ActionDecorator<This> {
	const decorator = createDecorator<This>('action', name, condition);

	const makeFilterable = (extras: Array<(target: any, context: ClassMethodDecoratorContext<any>) => void> = []) => {
		const chain = ((target: any, context: ClassMethodDecoratorContext<This>) => {
			decorator(target, context);
			for (const extra of extras) {
				extra(target, context);
			}
		}) as ActionDecorator<This>;

		chain.required = <T extends This>(values: string | string[] | ((self: T) => string[])) => {
			const extra = (target: any, context: ClassMethodDecoratorContext<T>) => {
				actionFilter('required')<T>(values)(target, context);
			};
			return makeFilterable([...extras, extra]);
		};
		chain.optional = <T extends This>(values: string | string[] | ((self: T) => string[])) => {
			const extra = (target: any, context: ClassMethodDecoratorContext<T>) => {
				actionFilter('optional')<T>(values)(target, context);
			};
			return makeFilterable([...extras, extra]);
		};
		chain.filter = <T extends This>(values: string | string[] | ((self: T) => string[])) => {
			const extra = (target: any, context: ClassMethodDecoratorContext<T>) => {
				actionFilter()<T>(values)(target, context);
			};
			return makeFilterable([...extras, extra]);
		};
		chain.flag = <T extends This>(flags: FlagGeneric | FlagGeneric[]) => {
			const extra = (target: any, context: ClassMethodDecoratorContext<T>) => {
				actionFlag<T>(flags)(target, context);
			};
			return makeFilterable([...extras, extra]);
		};

		return chain;
	};

	return makeFilterable();
}

export function actionManager(name: Action) {
	return createDecorator('actionManager', name, (self) => {
		// Lazy import to avoid circular dependency
		// at { getActionNames, hookNames, getHookFuncs } = require('./getters');
		return !!(
			actionNames(self).includes(name) ||
			hookNames(self)
				.filter((f: Hook) => f.startsWith(name))
				.find((h: Hook) => getHookFuncs(self, h)
					// `runners` use symbols for method names so their hooks cannot force a match by name
					.find((f: HandlerMethod) => typeof f === 'string')
				)
		);
	});
}

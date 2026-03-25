import { TSchema, Static } from '@sinclair/typebox';
import Compile from 'typebox/compile';
import { IsNever, Simplify, UnionToIntersection } from 'type-fest';
import { Constructor } from '../../types';
import { GenericMixin, MixinConfig } from './mixin-types';
import { IService } from './service-types';
import { ucfirst } from '../../utils';
import MixinMeta from './mixin-meta';
import { Config, CMixins } from './configs';

type ExtractBaseMixins<T extends readonly GenericMixin[]> =
	T extends readonly []
		? {}
		: UnionToIntersection<{
			[K in keyof T]: T[K] extends GenericMixin
				? T[K]['Mixin']
				: never
		}[number]>;

type MixinMethods<
	P,
	TBuilder extends (base: any) => any
> = Omit<InstanceType<ReturnType<TBuilder>>, Config.AllKeys | keyof IService<P>>;

type MixinIncludes = readonly GenericMixin[];

type MixinType<
	N extends string,
	TBox extends TSchema,
	MIncludes extends MixinIncludes,
	Key extends string = `mixin${Capitalize<N>}`,
	IncMixins = ExtractBaseMixins<MIncludes>,
	CStatic = IsNever<TBox> extends true ? {} : Static<TBox>,
	Config = CStatic & {
		[K in Key]?: CMixins.Mode;
	},
> = {
	Name: N;
	Key: Key;
	Config: UnionToIntersection<Config>;
	IncMixins: IsNever<IncMixins> extends true ? {} : IncMixins;
};

export const withMixin = <
	N extends string,
	MIncludesParam extends MixinIncludes,
	TBoxOrMixin extends TSchema | GenericMixin = never,
	TBox extends TSchema = TBoxOrMixin extends GenericMixin
		? never
		: TBoxOrMixin,
	MIncludes extends MixinIncludes = TBoxOrMixin extends GenericMixin
		? [TBoxOrMixin, ...MIncludesParam]
		: MIncludesParam,
	MType extends MixinType<N, TBox, MIncludes> = MixinType<N, TBox, MIncludes>,
>(name: N, schemaOrMixin?: TBoxOrMixin, ..._includeMixins: MIncludesParam) => <
	TExtend extends (
		Base: Constructor<MType['Config'] & MType['IncMixins'] & IService<any, N>>
	) => Constructor<any>,
>(extend: TExtend) => {
	const config = {
		name,
		key: `mixin${ucfirst(name)}` as MType['Key'],
	} as const satisfies MixinConfig;
	const validator = schemaOrMixin && (Symbol.for('TypeBox.Kind') in schemaOrMixin)
		? Compile(schemaOrMixin)
		: null;
	const configErrors = (instance: unknown) => {
		if (validator && !validator.Check(instance)) {
			return validator.Errors(instance).flatMap(e => e
				.message
				.replace('must have required properties', '')
				.split(', ')
				.map(s => s.trim())
				.filter(Boolean)
			);
		}
	};

	function apply<TBase extends Constructor<any>>(Base: TBase) {
		const staticMeta = Base.prototype.constructor;
		const errors = staticMeta.__config[config.key] === true
			? null
			: configErrors(staticMeta.__config) // try straight config first to avoid port function not existing
				? configErrors(staticMeta.mixinInstance(Base))
				: null;

		if (errors) {
			staticMeta.__mixins[config.key] = errors;
			return Base;
		}

		MixinMeta.start(config);
		const Extended = extend(Base);
		MixinMeta.flush(Extended.prototype);
		staticMeta.__mixins[config.key] = true;
		return Extended;
	}

	apply.Name = config.name as N;
	apply.Key = config.key as MType['Key'];
	apply.Config = {} as Simplify<MType['Config']>;
	apply.IncMixins = {} as Simplify<MType['IncMixins']>;
	apply.TExtend = extend;
	apply.Mixin = {} as Simplify<Omit<MixinMethods<any, TExtend>, keyof MType['IncMixins']>>;

	return apply;
};

import { UnionToIntersection } from "type-fest";

export type GenericMixin = {
	Mixin: Record<string, unknown>;
	Name: string;
	Key: string;
	Config: Record<string, unknown>;
};

export type MixinConfig = {
	name: string;
	key: string;
};

export type ApplyMixin<C, M extends GenericMixin> =
	C extends { [Key in M['Key']]: false }
		? {}
		: C extends { [Key in M['Key']]: true }
			? M['Mixin']
			: M['Config'] extends Record<string, never>
				? M['Mixin']
				: C extends M['Config']
					? M['Mixin']
					: {};
export type ApplyMixinsFromArray<C, T extends readonly any[]> = UnionToIntersection<{
	[K in keyof T]: T[K] extends GenericMixin
		? ApplyMixin<C, T[K]>
		: never
}[number]>;

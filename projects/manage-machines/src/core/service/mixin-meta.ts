import { MixinConfig } from './mixin-types';

export default class MixinMeta {
	private static map = new WeakMap<any, MixinConfig>();
	private static current: MixinConfig | null = null;

	static get(prototype: any) {
		return MixinMeta.current || MixinMeta.map.get(prototype);
	}

	static start(config: MixinConfig) {
		MixinMeta.current = config;
	}

	static flush(prototype: any) {
		MixinMeta.map.set(prototype, MixinMeta.current as MixinConfig);
		MixinMeta.current = null;
	}
}

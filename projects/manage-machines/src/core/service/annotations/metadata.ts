import { AnnotationType, ServiceMeta, ServiceMetaKey } from './types';

const PROP_KEY = Symbol('serviceMeta');

export function ensureMetadata(instance: any): ServiceMeta {
	if (!instance[PROP_KEY]) {
		instance[PROP_KEY] = {
			hooks: new Map(),
			actions: new Map(),
			actionManagers: new Map(),
			flags: new Map(),
			methodFilters: new Map(),
		};
	}
	return instance[PROP_KEY];
}

export function getMetadata(instance: any): ServiceMeta | void {
	return instance[PROP_KEY];
}

export function getMetadataMap(meta: ServiceMeta, type: AnnotationType) {
	return type === 'hook' ? meta.hooks : type === 'action' ? meta.actions : meta.actionManagers;
}

export function addToMetadataMap(meta: ServiceMeta, type: AnnotationType, key: ServiceMetaKey, methodName: string | symbol) {
	const map = getMetadataMap(meta, type) as Map<ServiceMetaKey, Set<string | symbol>>;
	if (!map.has(key)) {
		map.set(key, new Set());
	}
	map.get(key)!.add(methodName);
}

export function getFromMetadataMap(instance: any, type: AnnotationType, key: ServiceMetaKey) {
	const meta = getMetadata(instance);
	if (!meta) {
		return [];
	}

	const map = getMetadataMap(meta, type) as Map<ServiceMetaKey, Set<string | symbol>>;
	return [...(map.get(key) || [])];
}

import { useCallback, useEffect } from 'react';

import * as api from '../api';
import { CameraReaderDataApiResult, CameraStats, CameraStatsApiResult, CameraStatsDetailed, CameraStatsSimple } from '../types';
import { CameraConfig } from '../types';

type IParamsFetchStatsCallbackBase<T extends string, S extends CameraStats> = {
	type: T;
	cameraConfig: CameraConfig;
	onStats: (stats: S) => void;
	onError?: (err: Error) => void;
};
type IParamsFetchStatsCallbackSimple = IParamsFetchStatsCallbackBase<'simple', CameraStatsSimple>;
type IParamsFetchStatsCallbackDetailed = IParamsFetchStatsCallbackBase<'detailed', CameraStatsDetailed>;
type IParamsFetchStatsCallback = IParamsFetchStatsCallbackSimple | IParamsFetchStatsCallbackDetailed;

export const useFetchStatsCallback = (params: IParamsFetchStatsCallback, deps: unknown[] = []): (() => void) => {
	return useCallback(async () => {
		try {
			const statsSimple = await api.get<CameraStatsApiResult>(params.cameraConfig.statsUrl);

			if (params.type === 'simple') {
				params.onStats({
					timestamp: Date.now(),
					...statsSimple,
				});
			} else if (params.type === 'detailed') {
				params.onStats({
					...statsSimple,
					readers: await Promise.all(
						statsSimple.readers.map(async (reader) => {
							const url = params.cameraConfig.readerStatsUrlTemplate
								.replaceAll('{type}', `${reader.type.toLowerCase()}s`)
								.replaceAll('{id}', reader.id);
							return api.get<CameraReaderDataApiResult>(url);
						})
					),
				} as CameraStatsDetailed);
			}
		} catch (e) {
			params.onError?.(e as Error);
		}
	}, deps);
};

type IParamsFetchStatsEffect = {
	paused?: boolean;
	callback: () => void;
	refreshStatsMs: number;
};

export const useFetchStatsEffect = (params: IParamsFetchStatsEffect) => useEffect(() => {
	if (params.paused) {
		return;
	}

	params.callback();
	const timer = setInterval(() => params.callback(), params.refreshStatsMs);
	return () => clearTimeout(timer);
}, [params.refreshStatsMs, params.paused, params.callback]);

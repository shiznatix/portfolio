import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { CssVarsProvider } from '@mui/joy/styles';
import { Box, Button, Sheet, Typography } from '@mui/joy';
import AppsIcon from '@mui/icons-material/Apps';
import Remote from './Remote/Remote';
import Navigation from './Navigation';
import { ApiContext, ApiCtx, theme } from '../context';
import ErrorBox from './ErrorBox';
import { ErrorBoxContent, PlaylistItem, TvStatus, ViewKey, VlcStatus } from '../types';
import * as api from '../api';
import { useNavState, usePlaylistState, useTvStatusState, useViewState, useVlcStatusState } from '../state';
import MainView from './MainViews/MainView';
import { config } from '../config';

let _tvStatus: TvStatus | null = null;
let _vlcStatus: VlcStatus | null = null;
let _playlist: PlaylistItem[] = [];

export default function App(): React.ReactElement {
	const { setViewKey, viewMeta } = useViewState(state => ({
		setViewKey: state.setViewKey,
		viewMeta: state.getViewMeta(),
	}));
	const setTvStatus = useTvStatusState(state => state.setStatus);
	const setVlcStatus = useVlcStatusState(state => state.setStatus);
	const setPlaylistItems = usePlaylistState(state => state.setItems);
	const setNavState = useNavState(state => state.setOpen);

	const [remoteOpen, setRemoteOpen] = useState(false);
	const [errorBoxOpen, setErrorBoxOpen] = useState(false);
	const [errorBoxContent, setErrorBoxContent] = useState<ErrorBoxContent>(null);
	const [vlrVisible, setVlrVisible] = useState(true);
	const toggleRemote = useCallback((open: boolean) => () => setRemoteOpen(open), []);
	const handleViewKeyChange = useCallback((viewKey: ViewKey) => {
		setViewKey(viewKey);
		setRemoteOpen(false);
	}, []);
	const onNavClick = useCallback(() => setNavState(true), []);
	const apiCall: ApiCtx = useCallback(async (setLoadingOrFunc, func) => {
		const setLoading = func ? setLoadingOrFunc : (_: boolean) => {};
		const apiFunc = func ? func : setLoadingOrFunc;

		setLoading(true);

		try {
			// TODO annoying type definitions, improve at some point...
			// @ts-ignore
			const res = await apiFunc();
			setLoading(false);

			return res;
		} catch (e) {
			console.error(e);
			setErrorBoxContent(e as Error | api.ApiError);
			setErrorBoxOpen(true);
			setLoading(false);
		}
	}, []);
	const backgroundApiCall = useCallback((func: () => Promise<void>) => async () => {
		try {
			return await func();
		} catch (e) {
			console.error('Background API call failed: ', e);
		}
	}, []);

	useEffect(() => {
		if (!vlrVisible) {
			return;
		}

		const fetchStatus = backgroundApiCall(async () => {
			const res = await api.status();

			if (JSON.stringify(_vlcStatus) !== JSON.stringify(res.vlc)) {
				_vlcStatus = res.vlc;
				setVlcStatus(_vlcStatus);
			}
			if (JSON.stringify(_tvStatus) !== JSON.stringify(res.tv)) {
				_tvStatus = res.tv;
				setTvStatus(_tvStatus);
			}
		});
		fetchStatus();
		const timer = setInterval(() => fetchStatus(), 5000);
		return () => clearTimeout(timer);
	}, [vlrVisible, backgroundApiCall]);
	useEffect(() => {
		if (!vlrVisible) {
			return;
		}

		const fetchPlaylist = backgroundApiCall(async () => {
			const res = await api.playlist();

			if (JSON.stringify(_playlist) !== JSON.stringify(res)) {
				_playlist = res;
				setPlaylistItems(_playlist);
			}
		});
		fetchPlaylist();
		const timer = setInterval(() => fetchPlaylist(), 10000);
		return () => clearTimeout(timer);
	}, [vlrVisible, backgroundApiCall]);

	useLayoutEffect(() => {
		const notify = () => setVlrVisible(document.visibilityState === 'visible');

		setVlrVisible(document.visibilityState === 'visible');
		addEventListener('visibilitychange', notify);

		return () => removeEventListener('visibilitychange', notify);
	}, []);

	return (
		<CssVarsProvider
			disableNestedContext
			defaultMode="light"
			modeStorageKey="theme-mode"
			theme={theme}
		>
			<ApiContext.Provider value={apiCall}>
				<Sheet sx={{ height: '100%', width: '100%' }}>
					<Box sx={{ height: '100%', width: '85%', float: 'left' }}>
						<Box sx={{ height: '90%' }}>
							<MainView />
						</Box>

						<Button
							startDecorator={<AppsIcon />}
							endDecorator={React.cloneElement(viewMeta.icon, {
								color: 'primary',
							})}
							variant="outlined"
							color="neutral"
							onClick={onNavClick}
							size="lg"
							sx={{ height: '10%', width: '100%', padding: 0 }}
						>
							<Box>
								<Typography level="title-lg">{viewMeta.title}</Typography>
								<Typography level="title-sm">{config.name}</Typography>
							</Box>
						</Button>
					</Box>

					<Sheet
						style={{ transition: 'all 0.2s ease' }}
						variant="outlined"
						sx={{
							height: '100%',
							width: remoteOpen ? '100%' : '15%',
							right: 0,
							position: 'absolute',
							zIndex: 5,
						}}
					>
						<Remote
							open={remoteOpen}
							onOpen={toggleRemote(true)}
							onClose={toggleRemote(false)}
						/>
					</Sheet>
				</Sheet>

				<ErrorBox
					open={errorBoxOpen}
					content={errorBoxContent}
					onClose={() => setErrorBoxOpen(false)}
				/>

				<Navigation onClick={handleViewKeyChange} />
			</ApiContext.Provider>
		</CssVarsProvider>
	);
}

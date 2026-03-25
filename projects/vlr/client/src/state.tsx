import { create } from 'zustand'
import { IconBrowse, IconDownload, IconEpisode, IconRandom, IconStatus, IconUnknown } from './components/Icons';
import { PlaylistItem, TvStatus, ViewKey, VlcStatus } from './types';
import { config } from './config';

type NavState = {
	open: boolean;
	setOpen: (open: boolean) => void;
};

type ViewState = {
	viewKey: ViewKey;
	setViewKey: (viewKey: ViewKey) => void;
	getViewMeta: (viewKey?: ViewKey) => {
		title: string;
		icon: React.ReactElement;
	};
};

type TvStatusState = {
	status: TvStatus | null;
	setStatus: (tvStatus: TvStatus | null) => void;
};

type VlcStatusState = {
	status: VlcStatus | null;
	setStatus: (vlcStatus: VlcStatus | null) => void;
};

type PlaylistState = {
	items: PlaylistItem[];
	setItems: (items: PlaylistItem[]) => void;
};

export const useNavState = create<NavState>((set) => ({
	open: false,
	setOpen: (open: boolean) => set({ open }),
}));

export const useViewState = create<ViewState>()((set, get) => ({
	viewKey: config.defaultViewKey,
	setViewKey: (viewKey: ViewKey) => set({ viewKey }),
	getViewMeta: (viewKey?: ViewKey) => {
		viewKey = viewKey || get().viewKey;
		const title = viewKey === 'browse' ? 'Browse'
			: viewKey === 'random' ? 'Random'
			: viewKey === 'status' ? 'Status'
			: viewKey === 'downloads' ? 'Downloads'
			: viewKey === 'fsEpisodes' ? 'Episodes'
			: 'Unknown';
		const icon = viewKey === 'browse' ? <IconBrowse />
			: viewKey === 'fsEpisodes' ? <IconEpisode />
			: viewKey === 'random' ? <IconRandom />
			: viewKey === 'status' ? <IconStatus />
			: viewKey === 'downloads' ? <IconDownload />
			: <IconUnknown />;

		return {
			title,
			icon,
		};
	},
}));

export const useTvStatusState = create<TvStatusState>()((set) => ({
	status: null,
	setStatus: (status: TvStatus | null) => set({ status }),
}));

export const useVlcStatusState = create<VlcStatusState>()((set) => ({
	status: null,
	setStatus: (status: VlcStatus | null) => set({ status }),
}));

export const usePlaylistState = create<PlaylistState>()((set) => ({
	items: [],
	setItems: (items: PlaylistItem[]) => set({ items }),
}));

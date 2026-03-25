import ClearAllIcon from '@mui/icons-material/ClearAll';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import ListIcon from '@mui/icons-material/List';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import ClosedCaptionIcon from '@mui/icons-material/ClosedCaption';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import TuneIcon from '@mui/icons-material/Tune';
import TvOffIcon from '@mui/icons-material/TvOff';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import * as api from '../../api';
import { config } from '../../config';

const sendVolumeCmd = (cmd: string) => {
	if (config.defaultVolumeControl === 'tv') {
		return api.tvCommand(cmd);
	}
	if (config.defaultVolumeControl === 'system') {
		return api.systemCommand(cmd);
	}

	return api.playerCommand(cmd);
};

const buttons = {
	emptyPlaylist: {
		label: 'Empty Playlist',
		icon: <ClearAllIcon />,
		onClick: () => api.playerCommand('empty-playlist'),
	},
	playPause: {
		label: 'Play Pause',
		icon: <><PlayArrowIcon /><PauseIcon /></>,
		onClick: () => api.playerCommand('play-pause'),
	},
	volUp: {
		label: 'Vol Up',
		subLabel: config.defaultVolumeControl,
		icon: <VolumeUpIcon />,
		onClick: () => sendVolumeCmd('volume-up'),
	},
	volDown: {
		label: 'Vol Down',
		subLabel: config.defaultVolumeControl,
		icon: <VolumeDownIcon />,
		onClick: () => sendVolumeCmd('volume-down'),
	},
	mute: {
		label: 'Mute',
		subLabel: config.defaultVolumeControl,
		icon: <VolumeMuteIcon />,
		onClick: () => sendVolumeCmd('mute'),
	},
	playlist: {
		label: 'Playlist',
		icon: <ListIcon />,
	},
	forward: {
		label: 'Fwd',
		icon: <ArrowForwardIcon />,
		onClick: () => api.playerCommand('forward'),
	},
	back: {
		label: 'Back',
		icon: <ArrowBackIcon />,
		onClick: () => api.playerCommand('back'),
	},
	forwardLarge: {
		label: 'Fwd Large',
		icon: <FastForwardIcon />,
		onClick: () => api.playerCommand('forward-large'),
	},
	backLarge: {
		label: 'Back Large',
		icon: <FastRewindIcon />,
		onClick: () => api.playerCommand('back-large'),
	},
	next: {
		label: 'Next',
		icon: <SkipNextIcon />,
		onClick: () => api.playlistCommand('next'),
	},
	previous: {
		label: 'Prev',
		icon: <SkipPreviousIcon />,
		onClick: () => api.playlistCommand('previous'),
	},
	subtitles: {
		label: 'Subtitles',
		icon: <SubtitlesIcon />,
	},
	engSubs: {
		label: 'EngSubs',
		icon: <ClosedCaptionIcon />,
		onClick: (trackId: unknown) => api.setSubtitleTrack(trackId as number),
	},
	fullscreen: {
		label: 'Fullscreen',
		icon: <FullscreenIcon />,
		onClick: () => api.playerCommand('toggle-fullscreen'),
	},
	audio: {
		label: 'Audio',
		icon: <AudioFileIcon />,
	},
	close: {
		label: 'Close',
		icon: <CloseIcon />,
		onClick: () => api.playerCommand('close'),
	},
	addUrl: {
		label: 'Add URL',
		icon: <LinkIcon />,
	},
	volumes: {
		label: 'Volumes',
		icon: <TuneIcon />,
	},
	tvOn: {
		label: 'TV On',
		icon: <PowerSettingsNewIcon />,
		onClick: () => api.tvCommand('on'),
	},
	tvOff: {
		label: 'TV Off',
		icon: <TvOffIcon />,
		onClick: () => api.tvCommand('off'),
	},
	status: {
		label: 'Status',
		icon: <AnalyticsIcon />,
	},
};

export default buttons;

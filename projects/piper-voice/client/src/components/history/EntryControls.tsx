import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { RefObject } from 'react';

import { ConfirmButton } from '@rh/react';
interface EntryControlsProps {
	audioUrl: string | null;
	audioRef: RefObject<HTMLAudioElement | null>;
	isDownloading: boolean;
	isSynthesizing: boolean;
	onDownloadOgg: () => void;
	onDownloadWav: () => void;
	onResynthesize: () => void;
	onAudioError: () => void;
	onCopySettings: () => void;
	onDelete: () => void;
}

interface AudioOrSynthesizeProps {
	audioUrl: string | null;
	audioRef: RefObject<HTMLAudioElement | null>;
	isSynthesizing: boolean;
	onResynthesize: () => void;
	onAudioError: () => void;
}

const AudioOrSynthesize: React.FC<AudioOrSynthesizeProps> = ({ audioUrl, audioRef, isSynthesizing, onResynthesize, onAudioError }) => {
	if (audioUrl) {
		return (
			<audio
				controls
				preload="none"
				ref={audioRef}
				src={audioUrl}
				onError={onAudioError}
				style={{
					flex: 1,
					minWidth: 200,
				}}
			/>
		);
	}

	return (
		<Button
			size="small"
			variant="soft"
			color="success"
			startIcon={<VolumeUpIcon />}
			onClick={onResynthesize}
			loading={isSynthesizing}
			sx={{ flex: 1 }}
		>
			Synthesize
		</Button>
	);
};

const EntryControls: React.FC<EntryControlsProps> = ({
	audioUrl,
	audioRef,
	isDownloading,
	isSynthesizing,
	onDownloadOgg,
	onDownloadWav,
	onResynthesize,
	onAudioError,
	onCopySettings,
	onDelete,
}) => {
	return (
		<Stack
			direction="row"
			spacing={1}
			alignItems="center"
			flexWrap="wrap"
		>
			<AudioOrSynthesize
				audioUrl={audioUrl}
				audioRef={audioRef}
				isSynthesizing={isSynthesizing}
				onResynthesize={onResynthesize}
				onAudioError={onAudioError}
			/>
			<Button
				size="small"
				variant="outlined"
				startIcon={<DownloadIcon />}
				onClick={onDownloadOgg}
				loading={isDownloading}
				disabled={!audioUrl}
			>
				OGG
			</Button>
			<Button
				size="small"
				variant="outlined"
				startIcon={<DownloadIcon />}
				onClick={onDownloadWav}
				loading={isDownloading}
				disabled={!audioUrl}
			>
				WAV
			</Button>
			<IconButton
				size="small"
				onClick={onCopySettings}
				title="Copy settings"
				sx={{ border: '1px solid', borderColor: 'divider' }}
			>
				<ContentCopyIcon />
			</IconButton>
			<ConfirmButton
				size="small"
				variant="outlined"
				onConfirm={onDelete}
			/>
		</Stack>
	);
};

export default EntryControls;

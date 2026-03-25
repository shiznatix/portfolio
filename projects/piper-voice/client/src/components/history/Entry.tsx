import { useEffect, useRef, useState } from 'react';

import type { SynthesizeRequestFile } from '../../api';
import { synthesizeAudio } from '../../api';
import { useAutoPlay } from '../../contexts/AutoPlayContext';
import { useError } from '../../hooks/use-error';
import { useHistory } from '../../contexts/HistoryContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useFormInput } from '../../contexts/FormInputContext';
import type { HistoryEntry } from '../../types';
import { formatTimestamp } from '../../utils';
import EntryControls from './EntryControls';
import EntryMetadata from './EntryMetadata';
import Paper from '@mui/material/Paper';

interface EntryProps {
	entry: HistoryEntry;
	index?: number;
}

const Entry: React.FC<EntryProps> = ({
	entry,
	index = 0,
}) => {
	const [audioUrl, setAudioUrl] = useState<string | null>(entry.url);
	const [isDownloading, setIsDownloading] = useState(false);
	const [isSynthesizing, setIsSynthesizing] = useState(false);
	const audioRef = useRef<HTMLAudioElement>(null);
	const { setError } = useError();
	const { autoPlay } = useAutoPlay();
	const { setSettings } = useSettings();
	const { setText, setInputType } = useFormInput();
	const { deleteHistoryEntry, resynthesizeEntry, clearEntryUrl } = useHistory();

	useEffect(() => {
		if (audioUrl && autoPlay && audioRef.current) {
			audioRef.current.play().catch(() => {});
		}
	}, [audioUrl]);

	const handleAudioError = () => {
		clearEntryUrl(entry.fileName);
		setAudioUrl(null);
	};

	const handleDownload = async (format: 'ogg' | 'wav') => {
		setIsDownloading(true);
		try {
			let blobUrl: string;
			let fileName: string;

			if (entry.url?.endsWith(`.${format}`)) {
				const res = await fetch(entry.url);
				if (!res.ok) throw new Error(`Download failed with ${res.status}`);
				blobUrl = URL.createObjectURL(await res.blob());
				fileName = entry.fileName;
			} else {
				const request: SynthesizeRequestFile = {
					text: entry.text,
					voice: entry.settings.voice,
					lengthScale: entry.settings.lengthScale,
					noiseScale: entry.settings.noiseScale,
					noiseWScale: entry.settings.noiseWScale,
					format,
					response: 'file',
				};
				const result = await synthesizeAudio(request);
				blobUrl = URL.createObjectURL(result.blob);
				fileName = result.fileName || `piper-voice-${formatTimestamp(entry.timestamp).replace(/:/g, '-')}.${format}`;
			}

			const a = document.createElement('a');
			a.href = blobUrl;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(blobUrl);
		} catch (e) {
			setError(e instanceof Error ? e.message : `Failed to download ${format.toUpperCase()}`);
		} finally {
			setIsDownloading(false);
		}
	};

	const handleResynthesize = async () => {
		setIsSynthesizing(true);
		try {
			const url = await resynthesizeEntry(entry.fileName);
			setAudioUrl(url);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to synthesize audio');
		} finally {
			setIsSynthesizing(false);
		}
	};

	const handleUseSettings = () => {
		setSettings(entry.settings);
		setText(entry.text);
		setInputType('text');
	};

	return (
		<Paper sx={{
			p: 1,
			mb: 1,
			bgcolor: index % 2 !== 0 ? 'background.paper' : 'background.default',
		}}>
			<EntryMetadata
				entry={entry}
			/>

			<EntryControls
				audioUrl={audioUrl}
				audioRef={audioRef}
				isDownloading={isDownloading}
				isSynthesizing={isSynthesizing}
				onDownloadOgg={() => handleDownload('ogg')}
				onDownloadWav={() => handleDownload('wav')}
				onResynthesize={handleResynthesize}
				onAudioError={handleAudioError}
				onCopySettings={handleUseSettings}
				onDelete={() => deleteHistoryEntry(entry.fileName)}
			/>

			<Paper elevation={8} sx={{
				whiteSpace: 'pre-wrap',
				maxHeight: 500,
				overflow: 'auto',
				p: 1,
				mt: 1,
			}}>
				{entry.text}
			</Paper>
		</Paper>
	);
};

export default Entry;

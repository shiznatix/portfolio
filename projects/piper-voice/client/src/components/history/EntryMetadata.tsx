import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { HistoryEntry } from '../../types';
import { formatFileSize, formatTimestamp } from '../../utils';

interface EntryMetadataProps {
	entry: HistoryEntry;
}

const EntryMetadata: React.FC<EntryMetadataProps> = ({
	entry,
}) => {
	const voiceName = entry.settings.voice.split('-')[1] || entry.settings.voice;
	const timestamp = formatTimestamp(entry.timestamp);

	return (
		<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
			<Stack direction="row" spacing={1} alignItems="center">
				<Typography variant="body1" sx={{ color: 'text.secondary' }}>
					{timestamp}
				</Typography>
				<Chip size="small" label={`${entry.charCount} chars`} />
				<Chip size="small" label={`${formatFileSize(entry.fileSize)} MB`} />
			</Stack>
			<Stack direction="row" spacing={1} alignItems="center">
				<Chip size="small" variant="outlined" color="primary" label={voiceName} />
				<Typography variant="body1">
					L:{entry.settings.lengthScale} N:{entry.settings.noiseScale} NW:{entry.settings.noiseWScale}
				</Typography>
			</Stack>
		</Stack>
	);
};

export default EntryMetadata;

import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

import { useHistory } from '../../contexts/HistoryContext';
import { ConfirmButton } from '@rh/react';
import Entry from './Entry';

const History: React.FC = () => {
	const { history, clearHistory } = useHistory();
	const entries = useMemo(() => {
		return Object.values(history).sort((a, b) =>
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		);
	}, [history]);

	if (entries.length === 0) {
		return null;
	}

	return (
		<Paper variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
			<Stack direction="row" spacing={2} sx={{ mb: 2 }}>
				<Typography variant="h5">
					History
				</Typography>
				<ConfirmButton
					size="small"
					variant="outlined"
					onConfirm={clearHistory}
					icon={<DeleteSweepIcon />}
					label="Clear All"
				/>
			</Stack>
			<Box>
				{entries.map((entry, index) => (
					<Entry
						key={entry.fileName}
						entry={entry}
						index={index}
					/>
				))}
			</Box>
		</Paper>
	);
};

export default History;

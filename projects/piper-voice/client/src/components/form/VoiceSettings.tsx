import RefreshIcon from '@mui/icons-material/Refresh';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useState } from 'react';

import { useSettings } from '../../contexts/SettingsContext';
import { useVoices } from '../../contexts/VoicesContext';

const VoiceSettings: React.FC = () => {
	const { settings, setSettings } = useSettings();
	const { voices } = useVoices();
	const [flashing, setFlashing] = useState(false);

	const resetToDefaults = () => {
		if (!voices) {
			return;
		}

		const defaultVoiceValue = voices.voices[voices.default];
		setSettings({ voice: defaultVoiceValue, lengthScale: 1, noiseScale: 0, noiseWScale: 0 });
		setFlashing(true);
		setTimeout(() => setFlashing(false), 600);
	};

	return (
		<Stack
			direction="row"
			spacing={2}
			sx={{
				flexWrap: 'wrap',
				borderRadius: 1,
				transition: 'background-color 0.6s ease, border-color 0.6s ease',
				backgroundColor: flashing ? 'warning.light' : 'transparent',
				border: '2px solid',
				borderColor: flashing ? 'warning.main' : 'transparent',
				px: 0.5,
				pb: 0.5,
				pt: 1.5,
			}}
		>
			<FormControl sx={{ minWidth: 200, flex: 1 }} size="small">
				<InputLabel>Voice</InputLabel>
				<Select
					value={settings.voice}
					label="Voice"
					onChange={(e) => setSettings({ ...settings, voice: e.target.value })}
				>
					{Object.entries(voices?.voices || {}).map(([key, value]) => (
						<MenuItem key={value} value={value}>
							{key}
						</MenuItem>
					))}
				</Select>
			</FormControl>

			<TextField
				label="Speech Slowness"
				type="number"
				size="small"
				sx={{ minWidth: 150 }}
				inputProps={{ min: 0, max: 2, step: 0.1 }}
				value={settings.lengthScale}
				onChange={(e) => setSettings({ ...settings, lengthScale: parseFloat(e.target.value) || 0 })}
			/>

			<TextField
				label="Noise"
				type="number"
				size="small"
				sx={{ minWidth: 150 }}
				inputProps={{ min: 0, max: 2, step: 0.1 }}
				value={settings.noiseScale}
				onChange={(e) => setSettings({ ...settings, noiseScale: parseFloat(e.target.value) || 0 })}
			/>

			<TextField
				label="Noise Width"
				type="number"
				size="small"
				sx={{ minWidth: 150 }}
				inputProps={{ min: 0, max: 2, step: 0.1 }}
				value={settings.noiseWScale}
				onChange={(e) => setSettings({ ...settings, noiseWScale: parseFloat(e.target.value) || 0 })}
			/>

			<IconButton
				color="warning"
				onClick={resetToDefaults}
				disabled={flashing}
				title="Reset to defaults"
				sx={{ alignSelf: 'flex-end', border: '1px solid', borderColor: 'warning.main' }}
			>
				<RefreshIcon sx={{ transition: 'transform 0.6s ease', transform: flashing ? 'rotate(360deg)' : 'rotate(0deg)' }} />
			</IconButton>
		</Stack>
	);
};

export default VoiceSettings;

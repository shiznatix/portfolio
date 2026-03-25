import Box from '@mui/material/Box';

import { AutoPlayProvider } from '../contexts/AutoPlayContext';
import { ErrorProvider } from '../contexts/ErrorContext';
import Typography from '@mui/material/Typography';
import { HistoryProvider } from '../contexts/HistoryContext';
import { FormInputProvider } from '../contexts/FormInputContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { useVoices,VoicesProvider } from '../contexts/VoicesContext';
import ErrorDisplay from './ErrorDisplay';
import Form from './form/Form';
import History from './history/History';

import { Loadable, ThemedApp } from '@rh/react';

const AppContent: React.FC = () => {
	const { voicesLoading } = useVoices();

	return (
		<Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
			<Typography variant="h4" sx={{ mb: 3 }}>
				Piper Voice Synthesizer
			</Typography>

			<Loadable loading={voicesLoading} variant="overlay">
				<Form />
			</Loadable>

			<Loadable loading={voicesLoading} variant="blur">
				<ErrorDisplay />
				<History />
			</Loadable>
		</Box>
	);
};

const App: React.FC = () => {
	return (
		<ThemedApp service="piper-voice">
			<ErrorProvider>
				<AutoPlayProvider>
					<SettingsProvider>
						<VoicesProvider>
							<HistoryProvider>
								<FormInputProvider>
									<AppContent />
								</FormInputProvider>
							</HistoryProvider>
						</VoicesProvider>
					</SettingsProvider>
				</AutoPlayProvider>
			</ErrorProvider>
		</ThemedApp>
	);
};

export default App;

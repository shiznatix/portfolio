import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRef,useState } from 'react';

import { extractTextFromFile } from '../../api';
import { useFormInput } from '../../contexts/FormInputContext';
import { useError } from '../../hooks/use-error';
import { useHistory } from '../../contexts/HistoryContext';
import { useSettings } from '../../contexts/SettingsContext';
import FormInput from './FormInput';
import FormSubmit from './FormSubmit';
import VoiceSettings from './VoiceSettings';

const Form: React.FC = () => {
	const [status, setStatus] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const abortControllerRef = useRef<AbortController | null>(null);

	const { setError } = useError();
	const { settings } = useSettings();
	const { text, setText, file, setFile, setInputType } = useFormInput();
	const { synthesizeEntry } = useHistory();

	const handleCancel = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		setIsSubmitting(false);
		setStatus(null);
	};

	const handleExtractFile = async (signal: AbortSignal) => {
		const { text: extractedText } = await extractTextFromFile(file!, signal);
		setText(extractedText);
		setFile(null);
		setInputType('text');
		setStatus('Text extracted! Review and click synthesize to continue.');
	};

	const handleSynthesize = async (signal: AbortSignal) => {
		await synthesizeEntry(text, settings, signal);
		setStatus(null);
	};

	const doSubmit = async () => {
		setError(null);
		setIsSubmitting(true);
		setStatus(file ? 'Extracting text from PDF...' : 'Synthesizing...');

		abortControllerRef.current = new AbortController();
		try {
			if (file) {
				await handleExtractFile(abortControllerRef.current.signal);
			} else {
				await handleSynthesize(abortControllerRef.current.signal);
			}
		} catch (error) {
			const msg = error instanceof Error
				? error.name === 'AbortError'
					? 'Cancelled'
					: error.message
				: 'Unknown error';
			setError(msg);
		} finally {
			abortControllerRef.current = null;
			setIsSubmitting(false);
		}
	};

	return (
		<Paper variant="outlined" sx={{ p: 0.5, borderRadius: 1, mb: 2 }}>
			<Box component="form">
				<Stack spacing={2}>
					<VoiceSettings />

					<FormInput />

					<FormSubmit
						isSubmitting={isSubmitting}
						onSubmit={doSubmit}
						onCancel={handleCancel}
					/>

					<Typography variant="body2" sx={{
						textAlign: 'center',
						color: 'text.secondary',
						visibility: status ? 'visible' : 'hidden',
					}}>
						{status}
					</Typography>
				</Stack>
			</Box>
		</Paper>
	);
};

export default Form;

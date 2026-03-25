import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';

import { useAutoPlay } from '../../contexts/AutoPlayContext';
import { useFormInput } from '../../contexts/FormInputContext';

interface FormSubmitProps {
	isSubmitting: boolean;
	onSubmit: () => void;
	onCancel: () => void;
}

const FormSubmit: React.FC<FormSubmitProps> = ({ isSubmitting, onSubmit, onCancel }) => {
	const { autoPlay, setAutoPlay } = useAutoPlay();
	const { inputType, text, file } = useFormInput();

	const isDisabled = !isSubmitting && (
		(inputType === 'file' && !file) ||
		(inputType === 'text' && !text.trim())
	);

	return (
		<Stack
			direction="row"
			spacing={2}
			alignItems="center"
			paddingX={0.5}
		>
			<Button
				size="large"
				variant={isSubmitting ? 'outlined' : 'contained'}
				color={isSubmitting ? 'error' : 'primary'}
				disabled={isDisabled}
				onClick={isSubmitting ? onCancel : onSubmit}
				sx={{ flexGrow: 1 }}
			>
				{isSubmitting ? 'CANCEL' : inputType === 'file' ? 'EXTRACT TEXT' : 'SYNTHESIZE'}
			</Button>
			<FormControlLabel
				control={
					<Checkbox
						checked={autoPlay}
						onChange={(e) => setAutoPlay(e.target.checked)}
					/>
				}
				label="Auto-play"
				sx={{ whiteSpace: 'nowrap' }}
			/>
		</Stack>
	);
};

export default FormSubmit;

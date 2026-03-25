import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';

import { useError } from '../hooks/use-error';

const ErrorDisplay: React.FC = () => {
	const { error, clearError } = useError();

	if (!error) return null;

	return (
		<Alert
			severity="error"
			sx={{ mb: 2 }}
			action={
				<IconButton
					size="small"
					color="error"
					onClick={clearError}
				>
					<CloseRoundedIcon />
				</IconButton>
			}
		>
			{error}
		</Alert>
	);
}

export default ErrorDisplay;

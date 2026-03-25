import ClearIcon from '@mui/icons-material/Clear';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useRef, useState } from 'react';
import { ConfirmButton } from '@rh/react';

import { useFormInput } from '../../contexts/FormInputContext';

interface InputAreaProps {
	fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const InputArea: React.FC<InputAreaProps> = ({ fileInputRef }) => {
	const { inputType, text, setText, setFile } = useFormInput();

	if (inputType === 'text') {
		return (
			<TextField
				multiline
				minRows={4}
				maxRows={16}
				fullWidth
				value={text}
				onChange={(e) => setText(e.target.value)}
				placeholder="Enter text..."
			/>
		);
	}

	return (
		<input
			ref={fileInputRef}
			type="file"
			accept=".txt,.pdf"
			onChange={(e) => setFile(e.target.files?.[0] || null)}
		/>
	);
};

const FormInput: React.FC = () => {
	const { inputType, setInputType, text, setText, file, setFile } = useFormInput();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [flashing, setFlashing] = useState(false);

	const handleClear = () => {
		if (inputType === 'text') {
			setText('');
		} else {
			setFile(null);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
		setFlashing(true);
		setTimeout(() => setFlashing(false), 600);
	};

	const isClearDisabled = flashing || (inputType === 'text' ? !text : !file);

	return (
		<Stack
			spacing={2}
			sx={{
				borderRadius: 1,
				transition: 'background-color 0.6s ease, border-color 0.6s ease',
				backgroundColor: flashing ? 'warning.light' : 'transparent',
				border: '2px solid',
				borderColor: flashing ? 'warning.main' : 'transparent',
				px: 0.5,
				pb: 0.5,
			}}
		>
			<Stack direction="row" spacing={2} alignItems="center">
				<RadioGroup
					row
					value={inputType}
					onChange={(e) => setInputType(e.target.value as 'text' | 'file')}
				>
					<FormControlLabel value="text" control={<Radio />} label="Text Input" />
					<FormControlLabel value="file" control={<Radio />} label="File Upload" />
				</RadioGroup>

				<ConfirmButton
					variant="outlined"
					size="small"
					label="Clear"
					onConfirm={handleClear}
					disabled={isClearDisabled}
					icon={<ClearIcon />}
				/>
			</Stack>

			<InputArea fileInputRef={fileInputRef} />
		</Stack>
	);
};

export default FormInput;

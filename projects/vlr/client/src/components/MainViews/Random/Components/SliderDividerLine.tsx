import React, { useState } from 'react';
import { IconButton, Slider } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DividerLine from '../../../DividerLine';

type IProps = {
	defaultSliderValue: number;
	maxSliderValue: number;
	onUpdate: (value: number) => void;
};

export default function SliderDividerLine(props: IProps): React.ReactElement {
	const [sliderValue, setSliderValue] = useState(props.defaultSliderValue);
	const onSliderValueChange = (value: number) => {
		if (value >= 0 && value <= props.maxSliderValue) {
			setSliderValue(value);
			props.onUpdate(value);
		}
	};
	const stepSliderValue = (step: number) => {
		onSliderValueChange(sliderValue + step);
	};

	return (
		<DividerLine>
			<IconButton
				disabled={sliderValue === 0}
				onClick={() => stepSliderValue(-1)}
			>
				<RemoveIcon />
			</IconButton>
			<Slider
				onChange={(_, value) => onSliderValueChange(value as number)}
				value={sliderValue}
				max={props.maxSliderValue}
				sx={{ width: '100%' }}
			/>
			<IconButton
				disabled={sliderValue === props.maxSliderValue}
				onClick={() => stepSliderValue(1)}
			>
				<AddIcon />
			</IconButton>
		</DividerLine>
	);
}

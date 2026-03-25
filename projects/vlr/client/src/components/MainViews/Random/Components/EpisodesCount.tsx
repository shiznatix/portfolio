import React from 'react';
import { ButtonGroup, Grid, IconButton, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

type IProps = {
	count: number;
	minCount: number;
	maxCount: number;
	onUpdate: (c: number) => void;
}

export default function EpisodesCount(props: IProps): React.ReactElement {
	const updateCount = (val: number) => () => {
		const sum = props.count + val;
		const newCount = sum < props.minCount ? props.minCount : (sum > props.maxCount ? props.maxCount : sum);

		props.onUpdate(newCount)
	};

	return (
		<Grid container>
			<Grid xs={6}>
				<Typography
					sx={{
						height: '100%',
						width: '100%',
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
						fontSize: '2em',
					}}
				>
					{props.count}
				</Typography>
			</Grid>
			<Grid xs={6}>
				<ButtonGroup
					buttonFlex={1}
					sx={{ height: '100%', width: '100%' }}
				>
					<IconButton
						onClick={updateCount(-1)}
						disabled={props.count === props.minCount}
						color="warning"
						variant="soft"
						sx={{ width: '50%' }}
					>
						<RemoveIcon />
					</IconButton>
					<IconButton
						onClick={updateCount(1)}
						disabled={props.count === props.maxCount}
						color="primary"
						variant="solid"
						sx={{ width: '50%' }}
					>
						<AddIcon />
					</IconButton>
				</ButtonGroup>
			</Grid>
		</Grid>
	);
}

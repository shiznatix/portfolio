import React from 'react';
import { Box, Grid, IconButton, Snackbar, Typography } from '@mui/joy';
import CloseIcon from '@mui/icons-material/Close';
import { ErrorBoxContent } from '../types';
import { ApiError } from '../api';

type IProps = {
	open: boolean;
	content: ErrorBoxContent;
	onClose: () => void;
};

type IPropsContent = {
	content: IProps['content'];
};

function Content(props: IPropsContent) {
	if (typeof props.content === 'string') {
		return <Typography level="body-md">{props.content}</Typography>
	}
	if (props.content instanceof ApiError) {
		return (
			<Box>
				<Typography level="body-md">{props.content.message}</Typography>
				{props.content.messages &&
					<Typography level="body-sm">{props.content.messages.join(', ')}</Typography>
				}
				<Typography level="body-xs">{props.content.statusCode} {props.content.path}</Typography>
			</Box>
		);
	}
	if (props.content instanceof Error) {
		return <Typography level="body-md">{props.content.message}</Typography>;
	}

	return <Typography level="body-md">Unknown error</Typography>;
}

export default function ErrorBox(props: IProps): React.ReactElement {
	return (
		<Snackbar
			open={props.open}
			color="danger"
			autoHideDuration={3000}
			anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
			onClose={props.onClose}
			sx={{ maxHeight: '5%' }}
		>
			<Grid container sx={{ width: '100%' }}>
				<Grid xs={10}>
					<Content content={props.content} />
				</Grid>
				<Grid xs={2}>
					<IconButton
						onClick={props.onClose}
						color="danger"
						sx={{ height: '100%', width: '100%' }}
					>
						<CloseIcon />
					</IconButton>
				</Grid>
			</Grid>
		</Snackbar>
	);
}

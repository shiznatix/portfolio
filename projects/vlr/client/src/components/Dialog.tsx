import React from 'react';
import Button from '@mui/joy/Button';
import { Box, ButtonGroup, Modal, ModalDialog, Typography } from '@mui/joy';
import { MuiColor } from '../types';

interface IProps {
	open: boolean;
	title: string;
	cancelLabel?: string;
	onCancel?: () => void;
	primaryLabel?: string;
	onPrimaryAction?: () => void;
	primaryButtonDisabled?: boolean;
	primaryButtonColor?: MuiColor;
	secondaryLabel?: string;
	onSecondaryAction?: () => void;
	secondaryButtonDisabled?: boolean;
	disableMainContentComponent?: boolean;
	children: JSX.Element | JSX.Element[];
}

interface IMainContentProps {
	children: React.ReactNode | React.ReactNode[];
}

function MainContent(props: IMainContentProps): React.ReactElement {
	return (
		<Box sx={{
			overflowY: 'auto',
			overflowX: 'hidden',
		}}>
			{props.children}
		</Box>
	);
}

function Dialog(props: IProps): React.ReactElement {
	const children = Array.isArray(props.children) ? props.children : [props.children];
	const hasMainContent = !!children.find(c => c.type === MainContent);

	return (
		<Modal open={props.open}>
			<ModalDialog size="lg" sx={{ padding: '5px' }}>
				<Typography level="title-lg">
					{props.title}
				</Typography>

				{(hasMainContent || props.disableMainContentComponent) && children}
				{!hasMainContent && !props.disableMainContentComponent &&
					<MainContent>
						{children}
					</MainContent>
				}

					<ButtonGroup buttonFlex={1}>
						{props.onCancel &&
							<Button variant="outlined" onClick={props.onCancel}>
								{props.cancelLabel || 'Cancel'}
							</Button>
						}
						{props.onSecondaryAction &&
							<Button disabled={props.secondaryButtonDisabled} variant="soft" onClick={props.onSecondaryAction}>
								{props.secondaryLabel || 'Close'}
							</Button>
						}
						{props.onPrimaryAction &&
							<Button
								disabled={props.primaryButtonDisabled}
								variant="solid"
								color={props.primaryButtonColor || 'primary'}
								onClick={props.onPrimaryAction}
							>
								{props.primaryLabel || 'Save'}
							</Button>
						}
					</ButtonGroup>
			</ModalDialog>
		</Modal>
	);
}

export default {
	Dialog,
	MainContent,
};

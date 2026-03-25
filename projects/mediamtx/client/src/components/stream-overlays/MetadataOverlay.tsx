import IconLastFrameTime from '@mui/icons-material/AccessTime';
import IconMetadataOpened from '@mui/icons-material/Insights';
import IconMetadataClosed from '@mui/icons-material/ShowChart';
import IconReadersCount from '@mui/icons-material/VisibilityOutlined';
import Chip, { ChipProps } from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import React, { useEffect, useRef, useState } from 'react';

import {
	useCameraContext,
	useFps,
	useLastFrameTime,
	useMetadataExpanded,
	useReadersCount} from '../../contexts/context';
import { padStartZero } from '../../functions';

interface MetadataOverlayProps {
	opacity: number;
}

const MetadataOverlay: React.FC<MetadataOverlayProps> = (props) => {
	const metadataExpanded = useMetadataExpanded();
	const fps = useFps();
	const readersCount = useReadersCount();
	const lastFrameTime = useLastFrameTime();
	const { setUiState } = useCameraContext();
	const contentRef = useRef<HTMLDivElement>(null);
	const [contentWidth, setContentWidth] = useState(0);

	useEffect(() => {
		if (contentRef.current) {
			// Temporarily make it visible to measure
			contentRef.current.style.visibility = 'hidden';
			contentRef.current.style.width = 'auto';
			contentRef.current.style.opacity = '1';

			const width = contentRef.current.scrollWidth;
			setContentWidth(width);

			// Reset styles
			contentRef.current.style.visibility = '';
			contentRef.current.style.width = '';
			contentRef.current.style.opacity = '';
		}
	}, [fps, readersCount, lastFrameTime]);

	const chipProps: ChipProps = {
		size: 'small',
		variant: 'filled',
		color: 'default',
		sx: {
			opacity: props.opacity,
			bgcolor: 'secondary.opaqueDark',
			'&:hover': { bgcolor: 'secondary.main' },
			borderColor: 'secondary.main',
			borderWidth: 1,
		},
	};

	return (
		<Stack
			direction="row"
			spacing={0.5}
		>
			<Stack
				ref={contentRef}
				direction="row"
				spacing={0.5}
				alignItems="center"
				sx={{
					opacity: metadataExpanded ? 1 : 0,
					transition: 'all 0.5s ease',
					pointerEvents: metadataExpanded ? 'auto' : 'none',
					width: metadataExpanded ? `${contentWidth}px` : 0,
					overflow: 'hidden',
					whiteSpace: 'nowrap',
				}}
			>
				<Chip
					{...chipProps}
					label={`FPS: ${fps === null ? 'N/A' : padStartZero(fps)}`}
				/>

				<Chip
					{...chipProps}
					icon={<IconReadersCount />}
					label={readersCount === null ? 'N/A' : String(readersCount)}
				/>

				<Chip
					{...chipProps}
					icon={<IconLastFrameTime />}
					label={lastFrameTime?.split(':').pop() || 'N/A'}
				/>
			</Stack>

			<IconButton
				size="medium"
				color={metadataExpanded ? 'secondary' : 'default'}
				sx={{
					...chipProps.sx,
					opacity: 0.8,
					bgcolor: metadataExpanded ? 'secondary.opaqueLight' : 'secondary.opaqueDark',
				}}
				onClick={() => setUiState(prev => ({
					...prev,
					metadataExpanded: !prev.metadataExpanded,
				}))}
			>
				{metadataExpanded ? <IconMetadataOpened /> : <IconMetadataClosed />}
			</IconButton>
		</Stack>
	);
};

export default MetadataOverlay;

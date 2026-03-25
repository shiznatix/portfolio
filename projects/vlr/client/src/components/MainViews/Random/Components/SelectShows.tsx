import React, { useEffect, useState } from 'react';
import { Accordion, AccordionDetails, AccordionGroup, AccordionSummary, Stack, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import FlexChip from '../../../FlexChip';
import { ShowCategory, WidthLevel } from '../../../../types';

type AccordionCategory = ShowCategory & {
	totalCount: number;
	selectedCount: number;
};

type IProps = {
	widthLevel: WidthLevel;
	selected: string[];
	categories: ShowCategory[];
	onClick: (show: string) => void;
};

export default function SelectShows(props: IProps): React.ReactElement {
	const [showCategories, setShowCategories] = useState<AccordionCategory[]>([]);
	
	useEffect(() => {
		const categories = structuredClone(props.categories).map(category => ({
			...category,
			totalCount: category.shows.length,
			selectedCount: 0,
		}));
		
		for (const category of categories) {
			const total = category.shows.length;

			for (let i = total - 1; i >= 0; i--) {
				const show = category.shows[i];

				if (props.selected.includes(show)) {
					category.shows.splice(i, 1);
					category.selectedCount++;
				}
			}
		}
		
		setShowCategories(categories);
	}, [props.selected, props.categories]);

	const startDecorator = props.widthLevel === 'lg' || props.widthLevel === 'md' ? <AddIcon /> : null;

	return (
		<AccordionGroup>
			{showCategories.map((category) =>
				<Accordion
					key={category.label}
					variant={category.selectedCount > 0 ? 'soft' : 'plain'}
				>
					<AccordionSummary sx={{ dispaly: 'flex' }}>
						<Typography
							noWrap
							textOverflow="clip"
							level={`body-${props.widthLevel}`}
							sx={{ flex: 1 }}
						>
							{category.label}
						</Typography>
						<Typography
							noWrap
							textOverflow="clip"
							level="body-xs"
						>
							({category.selectedCount}/{category.totalCount})
						</Typography>
					</AccordionSummary>
					<AccordionDetails>
						<Stack direction="row" flexWrap="wrap">
							{category.shows.map(show =>
								<FlexChip
									key={show}
									startDecorator={startDecorator}
									onClick={() => props.onClick(show)}
									variant="outlined"
									withBorder={true}
									sx={{ width: '100%', margin: 0.1 }}
								>
									<Typography noWrap level="body-xs">{show}</Typography>
								</FlexChip>
							)}
						</Stack>
					</AccordionDetails>
				</Accordion>
			)}
		</AccordionGroup>
	);
}

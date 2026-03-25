import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

interface LoadableProps {
	loading: boolean;
	children: React.ReactNode;
	variant?: 'replace' | 'overlay' | 'blur';
}

export const Loadable: React.FC<LoadableProps> = ({
	loading,
	children,
	variant = 'replace',
}) => {
	if (variant === 'overlay' || variant === 'blur') {
		return (
			<Box sx={{ position: 'relative', height: '100%' }}>
				{children}
				{loading && (
					<Box sx={{
						position: 'absolute',
						inset: 0,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: 'rgba(255,255,255,0.6)',
						backdropFilter: 'blur(2px)',
						borderRadius: 1,
						zIndex: 1,
					}}>
						<CircularProgress sx={{
							display: variant === 'overlay' ? 'block' : 'none',
						}} />
					</Box>
				)}
			</Box>
		);
	}

	return (
		<Box sx={{ height: '100%' }}>
			<Box sx={{
				display: loading ? 'none' : '',
				height: '100%',
			}}>
				{children}
			</Box>
			<Box sx={{
				height: '100%',
				width: '100%',
				display: loading ? 'flex' : 'none',
				alignItems: 'center',
				justifyContent: 'center',
			}}>
				<CircularProgress />
			</Box>
		</Box>
	);
};

export default Loadable;

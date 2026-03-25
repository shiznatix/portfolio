import { pythonService } from '../../core/service/service-factory';

export type CrazyClkProps = {
	noDetectionMode: 'random' | 'impossible' | 'off';
	ports?: {
		http?: number;
	};
};

export default pythonService<CrazyClkProps>()({
	name: 'crayclk',
	configJson: true,
	serviceTemplate: 'service',
	piInterfaces: ['i2c', 'spi'],
	pythonSystemSitePackages: true,
	aptDependencies: [
		'python3-libgpiod',
	],
	props: {
		noDetectionMode: 'impossible',
	},
	ports: {
		http: 8000,
	},
})
(Base => class extends Base {
});

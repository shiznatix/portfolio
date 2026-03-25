import { pythonService } from '../../core/service/service-factory';

export type RhForecastProps = {
	prometheusServerUrl: string;
	weatherLookbackHours: number;
};

export default pythonService<RhForecastProps>()({
	name: 'rh-forecast',
	configJson: true,
	aptDependencies: [
		'python3-numpy',
	],
})(Base => class extends Base {
});

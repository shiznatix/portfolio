import { pythonService } from '../../core/service/service-factory';

export type FoneyProps = {
	baudrate?: number;
	gpioPower?: number;
	gpioSleep?: number;
	gpioInterruptWakeup?: number;
	gpioReset?: number;
	devPort?: string;
};

export default pythonService<FoneyProps>()({
	name: 'foney',
	configJson: true,
})(Base => class extends Base {
});

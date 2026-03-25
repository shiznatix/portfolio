import { action } from '../../core/service/annotations';
import { pythonService } from '../../core/service/service-factory';

export type RhServosProps = {
	// AD002 9G Servo Motor
	// Wishiot Small 1.5g Servo
	servos: {
		type: 'step' | 'continuous' | 'shutter';
		name: string;
		gpio: number;
		reverseDirection?: boolean;
		highLedGpio?: number;
		lowLedGpio?: number;
	}[];
	pinFactory?: 'pigpio' | 'rpigpio';
	ports?: {
		http?: number;
	};
};

export default pythonService<RhServosProps>()({
	name: 'rh-servos',
	configJson: true,
	rsyncUpExcludes: [
		'positions.json', // file that saves the last position of the servos, don't sync it
	],
	ports: {
		http: 8090,
	},
})(Base => class extends Base {
	@(action('install', t => t.props.pinFactory !== 'pigpio').optional('pi-config'))
	async install() {
		if (!this.flagsIncludeExplicit('pi-config') && this.props.pinFactory === 'pigpio') {
			await this.cmd('sudo systemctl enable pigpiod');
			await this.cmd('sudo systemctl start pigpiod');
		}
	}
});

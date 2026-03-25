import { hook } from '../../core/service/annotations';
import { pythonService } from '../../core/service/service-factory';

export type MarblesMotorProps = {
	servoGpio: number;
};

export default pythonService<MarblesMotorProps>()({
	name: 'marbles-motor',
})(Base => class extends Base {
	@hook('install.sync.end')
	async afterInstallSync() {
		await this.cmd('sudo systemctl enable pigpiod');
		await this.cmd('sudo systemctl start pigpiod');
	}
});

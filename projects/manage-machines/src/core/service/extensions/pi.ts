import { CCommon } from '../configs';
import { withMixin } from '../mixin-factory';
import { action } from '../annotations';
import flags from '../common/flags';
import apt from '../common/apt';

const pi = withMixin('pi', CCommon.Pi, flags, apt)
(Base => class extends Base {
	private async piIsPi() {
		const res = await this.cmd('cat /sys/firmware/devicetree/base/model', {
			noFail: true,
		});
		return res.stdout.toLowerCase().includes('raspberry');
	}

	@(action('sync', ({ piInterfaces: i }) => i?.length).optional('pi-config'))
	async piEnableInterfaces() {
		if (!(await this.piIsPi())) {
			this.log.warn('Not a Raspberry Pi - skipping pi interface configuration');
			return;
		}

		const interfaces = this.piInterfaces || [];
		for (const intf of interfaces) {
			const key = Array.isArray(intf) ? intf[0] : intf;
			const value = Array.isArray(intf) ? intf[1] : true;
			await this.piSetConfig(key, value);
		}
	}

	async piSetConfig(key: string, value: boolean | string) {
		value = typeof value === 'boolean'
			? value
				? '0'
				: '1'
			: value;
		await this.cmd(`sudo raspi-config nonint do_${key} ${value}`);
	}

	async piModel() {
		const res = await this.cmd('cat /sys/firmware/devicetree/base/model');

		return res.stdout
			.replaceAll('\x00', '')
			.replace('Raspberry Pi', '')
			.trim();
	}
});

export default pi;

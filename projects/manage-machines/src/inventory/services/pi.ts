import { action } from '../../core/service/annotations';
import { nakedService } from '../../core/service/service-factory';

export type PiProps = {
	preset?: 'performance' | 'powersave';
	cpuGovernor?: 'ondemand' | 'performance' | 'conservative'; // 'powersave' - can make the pi un-bootable
	pciePolicy?: 'performance' | 'powersave' | 'default';
	raspiConfigUpdate?: boolean; // default On
	wifi?: 'powersave' | boolean; // ~200mW
	vnc?: boolean;
	spi?: boolean;
	i2c?: boolean;
	bluetooth?: boolean; // ~100mW
	oneWire?: boolean;
	hdmi?: boolean; // ~50mW
	screenBlanking?: boolean;
	activityLed?: boolean; // ~5mW
	usbAutoSuspend?: boolean; // ~50mW
	cameraAutoDetect?: boolean; // ~50mW
	swapSizeMb?: number;
	// zero2wPowerProfile?: 'powersave' | 'medium' | 'performance';
	configTxt?: string[];
};

const WIFI_PWR_TEMPLATE = `
[connection]
# Values are 0 (use default), 1 (ignore/don't touch), 2 (disable) or 3 (enable).
wifi.powersave = {{VALUE}}
`;
const WIFI_PWR_FILE = '/etc/NetworkManager/conf.d/wifi-powersave.conf';

export default nakedService<PiProps>()({
	name: 'pi',
	mixinPi: true,
	aptDependencies: [
		'i2c-tools',
	],
	debugFiles: [
		{ path: WIFI_PWR_FILE, sudo: true },
	],
})(Base => class extends Base {
	private computed: PiProps = {
		...(this.props.preset === 'powersave' ? {
			usbAutoSuspend: true,
			activityLed: false,
			bluetooth: false,
			cameraAutoDetect: false,
			hdmiBlanking: true,
			oneWire: false,
			wifi: 'powersave',
			// zero2wPowerProfile: 'powersave',
			pciePolicy: 'powersave',
		} : {}),
		...(this.props.preset === 'performance' ? {
			// zero2wPowerProfile: 'performance',
			cpuGovernor: 'performance',
			pciePolicy: 'performance',
		} : {}),
		...this.props,

	};
	private async setConfigIf(key: string, value?: boolean | string) {
		if (typeof value === 'boolean' || value) {
			await this.piSetConfig(key, value);
		}
	}

	@action('install', t => t.props.raspiConfigUpdate !== false)
	async updateRaspiConfig() {
		await this.cmd('sudo raspi-config nonint do_update', {
			exitOnStr: 'reloading raspi-config',
			noFail: true,
		});
	}

	@action('install')
	async setWifiPowerSave() {
		await this.write(
			WIFI_PWR_FILE,
			WIFI_PWR_TEMPLATE.replace(
				'{{VALUE}}',
				this.computed.wifi === 'powersave' ? '3' : '2',
			),
			{
				owner: 'root',
				permissions: '600',
			},
		);
	}

	@action('sync')
	async setConfigs() {
		const cpuGovernor = this.computed.cpuGovernor || 'ondemand';
		await this.cmd(`echo ${cpuGovernor} | sudo tee /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor`);
		const pciePolicy = this.computed.pciePolicy || 'default';
		await this.cmd(`echo ${pciePolicy} | sudo tee /sys/module/pcie_aspm/parameters/policy`)

		await this.setConfigIf('vnc', this.computed.vnc);
		await this.setConfigIf('spi', this.computed.spi);
		await this.setConfigIf('i2c', this.computed.i2c);
		await this.setConfigIf('onewire', this.computed.oneWire);
		await this.setConfigIf('blanking', this.computed.screenBlanking);

		if (this.computed.swapSizeMb) {
			await this.aptInstall(['dphys-swapfile']);
			await this.cmd(`sudo dphys-swapfile swapoff`);
			await this.configRemove('/etc/dphys-swapfile');
			await this.configAppend('/etc/dphys-swapfile', `CONF_SWAPSIZE=${this.computed.swapSizeMb}`);
			await this.cmd(`sudo dphys-swapfile setup`);
			await this.cmd(`sudo dphys-swapfile swapon`);
		}

		const firmwareLines = this.computed.configTxt || [];
		const commentOut: string[] = [];
		if (this.computed.wifi === false) {
			firmwareLines.push('dtoverlay=disable-wifi');
		}
		if (this.computed.bluetooth === false) {
			firmwareLines.push('dtoverlay=disable-bt');
		}
		if (this.computed.hdmi) {
			commentOut.push('hdmi_blanking');
			commentOut.push('hdmi_force_hotplug');
			commentOut.push('hdmi_ignore_hotplug');
			firmwareLines.push('hdmi_blanking=2');
			firmwareLines.push('hdmi_force_hotplug=0');
			firmwareLines.push('hdmi_ignore_hotplug=1');
		}
		if (this.computed.activityLed === false) {
			firmwareLines.push('dtparam=act_led_trigger=none');
		}
		if (this.computed.usbAutoSuspend === true) {
			firmwareLines.push('usbcore.autosuspend=1');
		}
		if (this.computed.cameraAutoDetect === false) {
			commentOut.push('camera_auto_detect');
			firmwareLines.push('camera_auto_detect=0');
		}
		// if (this.computed.zero2wPowerProfile === 'powersave') {
		// 	firmwareLines.push('gpu_mem=32');
		// 	firmwareLines.push('arm_freq=600');
		// 	firmwareLines.push('core_freq=200');
		// 	firmwareLines.push('force_turbo=0');
		// }
		// if (this.computed.zero2wPowerProfile === 'medium') {
		// 	firmwareLines.push('gpu_mem=64');
		// 	firmwareLines.push('arm_freq=800');
		// 	firmwareLines.push('core_freq=200');
		// 	firmwareLines.push('force_turbo=0');
		// }
		// if (this.computed.zero2wPowerProfile === 'performance') {
		// 	firmwareLines.push('gpu_mem=128');
		// 	firmwareLines.push('arm_freq=1000');
		// 	firmwareLines.push('core_freq=250');
		// 	firmwareLines.push('force_turbo=0');
		// }

		await this.configReplace('/boot/firmware/config.txt', {
			commentOut,
			config: firmwareLines,
		});
	}

	@action('status')
	async status() {
		const piModel = await this.piModel();
		this.log(`Pi Model: ${piModel}`);
		this.log('');

		// interface status
		const interfaces = ['vnc', 'spi', 'i2c', 'onewire', 'blanking'] as const;
		this.log('Interface Status:');
		for (const iface of interfaces) {
			const { stdout } = await this.cmd(`sudo raspi-config nonint get_${iface}`, {
				noFail: true,
				silent: true,
			});
			const status = stdout.trim() === '0' ? 'enabled' : 'disabled';
			this.log(`  ${iface.padEnd(10)}: ${status}`);
		}
		this.log('');

		// PCIe policy
		const { stdout: pciePolicyOut } = await this.cmd(`cat /sys/module/pcie_aspm/parameters/policy`, {
			noFail: true,
			silent: true,
		});
		this.log(`PCIe Policy: ${pciePolicyOut.trim()}`);
		this.log('');

		// GPU memory
		const { stdout: gpuMem } = await this.cmd(`vcgencmd get_mem gpu`, {
			noFail: true,
			silent: true,
		});
		this.log(`GPU Memory: ${gpuMem.trim()}`);
		this.log('');

		// swap size
		const { stdout: swapSize } = await this.cmd(`free -m | grep Swap | awk '{print $2}'`, {
			noFail: true,
			silent: true,
		});
		this.log(`Swap Size: ${swapSize.trim()}MB`);
		this.log('');

		const { stdout: i2cDetect } = await this.cmd('sudo i2cdetect -y 0; sudo i2cdetect -y 1', {
			noFail: true,
			silent: true,
		});
		this.log('I2C Devices:');
		this.log(i2cDetect);
		this.log('');

		await this.cmd(`qq pi throttling`, {
			noFail: true,
		});
	}
});

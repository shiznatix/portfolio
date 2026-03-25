import fs from 'fs/promises';
import { nakedService } from '../../core/service/service-factory';
import { action, hook } from '../../core/service/annotations';

export type IrRemoteProps = {
	gpioRead?: number;
	gpioWrite: number;
	lircDeviceNumber: number;
	remoteConfigs: {
		[key: string]: string;
	}
};

const CONFIG_OPTS = {
	startStr: '# mm-ir-remote',
	endStr: '# end mm-ir-remote',
} as const;

export default nakedService<IrRemoteProps>()({
	name: 'ir-remote',
	aptDependencies: [
		'ir-keytable',
		'lirc',
	],
})(Base => class extends Base {
	@hook('install.begin')
	@hook('uninstall.begin')
	async removeConfigs() {
		await this.configRemove('/boot/firmware/config.txt', CONFIG_OPTS);
		await this.configRemove('/etc/lirc/lirc_options.conf', CONFIG_OPTS);
		await this.cmd(`sudo sed -i "s/#driver/driver/g" /etc/lirc/lirc_options.conf`, {
			noFail: true,
		});
		await this.cmd(`sudo sed -i "s/#device/device/g" /etc/lirc/lirc_options.conf`, {
			noFail: true,
		});
	}

	@action('install')
	async install() {
		await this.configAppend('/boot/firmware/config.txt', [
			`dtoverlay=gpio-ir-tx,gpio_pin=${this.props.gpioWrite}`,
			(this.props.gpioRead ? `dtoverlay=gpio-ir,gpio_pin=${this.props.gpioRead}` : ''),
			// 'dtoverlay=lirc-rpi,debug',
		]);

		// TODO - not sure if anything is working yet...
		const { stdout: lircOptions } = await this.cmd('cat /etc/lirc/lirc_options.conf');
		const newLircOptions = lircOptions.split('\n').map(l => l.trim()).map(l => {
			if (l.startsWith('driver') && l.endsWith('devinput')) {
				return [
					`#${l}`,
					CONFIG_OPTS.startStr,
					l.replace('devinput', 'default'),
					CONFIG_OPTS.endStr,
				].join('\n');
			} else if (l.startsWith('device') && l.endsWith('auto')) {
				return [
					`#${l}`,
					CONFIG_OPTS.startStr,
					l.replace('auto', `/dev/lirc${this.props.lircDeviceNumber}`),
					CONFIG_OPTS.endStr,
				].join('\n');
			}

			return l;
		}).join('\n');
		await this.write('/etc/lirc/lirc_options.conf', newLircOptions, {
			owner: 'root',
			permissions: '644',
		});

		for (const [name, config] of Object.entries(this.props.remoteConfigs)) {
			const c = await fs.readFile(config, 'utf8');
			await this.write(`/etc/lirc/lircd.conf.d/${name}`, c, {
				owner: 'root',
			});
		}

		const reboot = await this.promptWantingYes('Reboot machine for changes to take effect?');
		if (reboot) {
			await this.hostRestart();
			return;
		}

		await this.cmd('sudo systemctl restart lircd');
	}

	@action('uninstall')
	async uninstall() {
		await this.aptUninstall(this.aptDependencies);
		await this.cmd('sudo rm -rf /etc/lirc');
	}
});

import { action, hook } from '../../core/service/annotations';
import { nakedService } from '../../core/service/service-factory';

export type LcdDisplayProps = {
	type: 'piscreen';
	rotate?: 0 | 90 | 180 | 270;
	speed?: 32000000 | 27000000 | 20000000 | 16000000 | 12000000 | 8000000 | 4000000 | 2000000; // default 16000000
	fbconMap?: string;
} | {
	type: 'st7735';
	rotate?: 0 | 90 | 180 | 270; // default 90
	speed?: 12000000 | 8000000 | 4000000 | 2000000; // default 4000000
	// 128x128 (default 160x128)
	// dc_pin (default 24)
	// reset_pin (default 25)
	// led_pin (default 18)
};

const CONFIG_OPTS = {
	startStr: '# mm-lcd-display',
	endStr: '# end mm-lcd-display',
} as const;

// TODO - move all this over to the `pi` service
export default nakedService<LcdDisplayProps>()({
	name: 'lcd-display',
	piInterfaces: ['i2c', 'spi'],
	aptDependencies: ['evtest', 'xinput'],
})(Base => class extends Base {
	@hook('install.end')
	@hook('uninstall.end')
	async reboot() {
		await this.hostRestart();
	}

	@(action('sync').flag('reboot'))
	async sync() {
		if (this.props.type === 'piscreen') {
			const speed = this.props.speed ?? 16000000;
			const rotate = this.props.rotate ?? 0;
			const fbconMap = this.props.fbconMap ?? '2';
			await this.configReplace('/boot/firmware/config.txt', {
				commentOut: [
					'dtoverlay=vc4-kms-v3d',
					'disable_fw_kms_setup',
					'max_framebuffers',
				],
				config: [
					`dtoverlay=piscreen,drm,speed=${speed},rotate=${rotate}`,
					'disable_fw_kms_setup=1',
					'max_framebuffers=1',
				],
			}, CONFIG_OPTS);

			await this.cmd(`sudo sed -i -E 's/fbcon=map[^ ]*/fbcon=map:${fbconMap}/; t; s/$/ fbcon=map:${fbconMap}/' /boot/firmware/cmdline.txt`);
			await this.cmd(`sudo sed -i -e 's/ vt\\.global_cursor_default=[^ ]*//g' -e 's/$/ vt.global_cursor_default=0/' /boot/firmware/cmdline.txt`);
			// await this.cmd(`sudo sed -i -E 's/fbcon=font[^ ]*/fbcon=font:VGA8x8/; t; s/$/ fbcon=font:VGA8x8/' /boot/firmware/cmdline.txt`);
		} else if (this.props.type === 'st7735') {
			const speed = this.props.speed ?? 4000000;
			const rotate = this.props.rotate ?? 0;
			await this.configReplace('/boot/firmware/config.txt', {
				commentOut: [
					'dtoverlay=vc4-kms-v3d',
					'disable_fw_kms_setup',
				],
				config: [
					'dtoverlay=vc4-fkms-v3d',
					`dtoverlay=adafruit-st7735r,speed=${speed},rotate=${rotate}`,
					'disable_fw_kms_setup=1',
				],
			}, CONFIG_OPTS);
		}

		if (this.flags.reboot) {
			await this.hostRestart();
		}
	}

	@action('uninstall')
	async uninstall() {
		await this.configRemove('/boot/firmware/config.txt', CONFIG_OPTS);
		await this.cmd(`sudo rm -rf ${this.workDir}`, {
			noFail: true,
		});
	}

	@action('test')
	async test() {
		await this.cmd(`sudo ${this.workDir}/test.sh`);
	}

	@action('debug')
	async debugConfig() {
		await this.cmd(`sudo ${this.workDir}/diagnostics.sh`);
	}
});

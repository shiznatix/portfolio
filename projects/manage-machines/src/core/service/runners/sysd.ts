import { CCommon, CService } from '../configs';
import { actionManager, hook } from '../annotations';
import { withMixin } from '../mixin-factory';
import files from '../common/files';
import sysd from '../extensions/sysd';
import { TriggerOpts } from '../service-types';
import { Type } from '@sinclair/typebox';

const managerDeps = Symbol('sysd.managerDeps');
const hookInstallBegin = Symbol('sysd.hookInstallBegin');
const hookInstallSyncEnd = Symbol('sysd.hookInstallSyncEnd');
const hookInstallEnd = Symbol('sysd.hookInstallEnd');
const hookSyncEnd = Symbol('sysd.hookSyncEnd');
const hookUninstallBegin = Symbol('sysd.hookUninstallBegin');
const hookUninstallEnd = Symbol('sysd.hookUninstallEnd');

const runnerSysd = withMixin(
	'runnerSysd',
	Type.Intersect([
		CService.Sysd,
		Type.Partial(CCommon.Python),
	]),
	files, sysd,
)(Base => class extends Base {
	@actionManager('deps')
	async [managerDeps](opts?: TriggerOpts) {
		if (this.isPython) {
			await this.triggerAction('sync', opts);
		}
		await this.triggerAction('deps', opts);
		if (this.isPython) {
			await this.triggerAction('restart', opts);
		}
	}

	@hook('install.begin')
	async [hookInstallBegin]() {
		await this.sysdStop({
			noFail: true,
		});
	}

	@hook('install.sync.end', t => t.unitSrcFilePath && t.unitFilePath)
	async [hookInstallSyncEnd]() {
		await this.cmd(`sudo ln -s ${this.unitSrcFilePath} ${this.unitFilePath}`, {
			noFail: true,
			silent: true,
		});
	}

	@hook('install.end', t => t.unitInstallable)
	async [hookInstallEnd]() {
		await this.sysdReload();
		await this.sysdEnable();
		await this.sysdStop({
			noFail: true,
		});
		await this.sysdStart({
			waitRunning: true,
		});
	}

	@hook('sync.end', t => t.unitInstallable)
	async [hookSyncEnd]() {
		if (this.initiatingAction !== 'sync') {
			return;
		}
		await this.sysdReload();

		if (this.restartOnSync !== 'never') {
			await this.sysdRestart({
				force: this.restartOnSync === 'always',
				waitRunning: true,
				noFail: true,
			});
		}
	}

	@hook('uninstall.begin')
	async [hookUninstallBegin]() {
		const opts = { noFail: true };

		if (this.unitInstallable) {
			await this.sysdStop(opts);
			await this.sysdDisable(opts);
		}

		if (this.unitFilePath) {
			await this.cmd(`sudo rm -f ${this.unitFilePath}`, opts);
		}
		if (this.unitFileName) {
			await this.cmd(`sudo rm -f /etc/systemd/system/${this.unitFileName}`, opts);
			await this.cmd(`sudo rm -f /etc/systemd/system/multi-user.target.wants/${this.unitFileName}`, opts);
			await this.cmd(`sudo rm -f /etc/systemd/system/default.target.wants/${this.unitFileName}`, opts);
			await this.cmd(`sudo rm -f /usr/lib/systemd/system/${this.unitFileName}`, opts);
		}
	}

	@hook('uninstall.end')
	async [hookUninstallEnd]() {
		const opts = { noFail: true };
		await this.sysdReload(opts);
		await this.sysdResetFailed(opts);
	}
});

export default runnerSysd;

import { Type } from '@sinclair/typebox';
import { CCommon, CService } from '../configs';
import { withMixin } from '../mixin-factory';
import { hook } from '../annotations';
import files from '../common/files';

const runnerDesktop = withMixin(
	'runnerDesktop',
	Type.Intersect([
		CCommon.WorkDir,
		CService.Desktop,
	]),
	files,
)(Base => class extends Base {
	@hook('install.begin')
	async runDesktopinstallPrior() {
		await this.triggerAction('uninstall');
	}
	@hook('install.sync.end', t => t.autoStartDir)
	async runSdSrcLinkUnitFile() {
		await this.cmd(`ln -s ${this.unitFilePath} ${this.autoStartDir}/${this.unitFileName}`);
	}

	@hook('uninstall.end')
	async runDesktopUninstallAfter() {
		await this.cmd(`rm -f ${this.workDir}/${this.unitFileName}`);
		if (this.autoStartDir) {
			await this.cmd(`rm -f ${this.autoStartDir}/${this.unitFileName}`);
		}
	}
});

export default runnerDesktop;

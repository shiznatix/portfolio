import { Type } from '@sinclair/typebox';
import { CCommon } from '../configs';
import { action, hook } from '../annotations';
import { withMixin } from '../mixin-factory';
import flags from '../common/flags';
import apt from '../common/apt';
import files from '../common/files';
import host from '../common/host';

const python = withMixin(
	'python',
	Type.Intersect([
		CCommon.WorkDir,
		CCommon.Python,
	]),
	flags, apt, files, host,
)(Base => class extends Base {
	@(action('deps').optional('python'))
	@hook('install.sync.end', t => t.flagsInclude('python'))
	protected async pyDependencies() {
		const { code } = await this.cmd(`dpkg-query -s python3-dev >/dev/null 2>&1`, {
			noFail: true,
		});
		if (code !== 0) {
			await this.aptInstall(['python3-dev']);
		}

		if (this.initiatingAction === 'install') {
			await this.cmd(`which uv || ((curl -LsSf https://astral.sh/uv/install.sh | sh) && sudo ln -s /home/${this.host.username}/.local/bin/uv /usr/local/bin/)`);
		}

		const reqTxtExists = await this.fileExists(`pyproject.toml`);

		if (!reqTxtExists || this.pythonSystemSitePackages) {
			const sysPackages = this.pythonSystemSitePackages ? '--system-site-packages' : '';
			await this.cmd(`uv venv --directory ${this.workDir} --allow-existing ${sysPackages}`);
		}

		if (!reqTxtExists) {
			this.log.warn('No pyproject.toml found, skipping python dependencies installation.');
			return;
		}

		const arch = await this.arch();
		await this.cmd(`cp ${this.workDir}/uv.lock.${arch} ${this.workDir}/uv.lock || true`);
		const flags = [
			`--directory ${this.workDir}`,
			...(this.pythonExtraPackages?.map(e => `--extra ${e}`) || []),
			'--no-dev',
			'--locked',
			'--compile-bytecode',
		].filter(f => f).join(' ');

		await this.cmd(`uv sync ${flags}`);
	}
});

export default python;

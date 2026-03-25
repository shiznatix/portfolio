import { Type } from '@sinclair/typebox';
import chalk from 'chalk';
import { CCommon } from '../configs';
import { action, hook } from '../annotations';
import { withMixin } from '../mixin-factory';
import flags from '../common/flags';
import files from '../common/files';

const configEnv = withMixin(
	'configEnv',
	Type.Intersect([CCommon.WorkDir, CCommon.ConfigEnv]),
	flags, files
)(Base => class extends Base {
	private readonly configEnvContent = Object.entries(this.configEnv)
		.map(([key, value]) => `${key}="${value}"`)
		.join('\n');

	@hook('sync.end')
	async configEnvWrite() {
		const dir = this.configEnvDir || this.workDir;
		const path = `${dir}/.env`;
		await this.write(path, this.configEnvContent, {
			owner: this.host.username,
			permissions: '600',
		});
	}

	@(action('debug').optional('env'))
	async configEnvPrint() {
		this.log(chalk.bold('--- Config ENV ---'));
		this.log(this.configEnvContent);
		this.log(chalk.bold('--- /Config ENV ---'));
	}
});

export default configEnv;

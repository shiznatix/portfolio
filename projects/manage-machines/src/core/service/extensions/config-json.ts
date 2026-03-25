import { Type } from '@sinclair/typebox';
import chalk from 'chalk';
import { CCommon } from '../configs';
import { action, hook } from '../annotations';
import { withMixin } from '../mixin-factory';
import { prettyJson } from '../../../utils';
import flags from '../common/flags';
import files from '../common/files';

const configJson = withMixin(
	'configJson',
	Type.Intersect([
		CCommon.WorkDir,
		CCommon.ConfigJson,
	]),
	flags, files,
)(Base => class extends Base {
	getConfigJson() {
		const config = {
			...(
				this.configJson === true
					? this.props
					: this.configJson
			) as Record<string, any>,
			ports: this.ports(),
			hostname: this.host.name,
		};
		const json = prettyJson(config)
			// TODO this breaks for things like `piper-voice-client` for the `apiUrl` value...
			// .replaceAll(this.host.ip, '127.0.0.1');

		return json;
	}

	getConfigJsonFilePath() {
		const dir = this.configJsonDir || this.workDir;
		const name = this.configJsonFileName || 'config.json';
		return `${dir}/${name}`;
	}

	@hook('sync.end')
	async configJsonWrite() {
		const json = this.getConfigJson();
		const path = this.getConfigJsonFilePath();
		await this.write(path, json, {
			owner: this.host.username,
			permissions: '600',
		});
	}

	@(action('debug').optional('json'))
	async configJsonPrint() {
		const json = this.getConfigJson();
		this.log(chalk.bold('--- Config JSON ---'));
		this.log(json);
		this.log(chalk.bold('--- /Config JSON ---'));
	}
});

export default configJson;

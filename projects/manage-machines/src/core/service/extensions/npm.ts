import { Type } from '@sinclair/typebox';
import { CCommon, CServiceCommon } from '../configs';
import { withMixin } from '../mixin-factory';
import { action, hook } from '../annotations';
import flags from '../common/flags';
import files from '../common/files';
import configJson from './config-json';
import { CmdOpts } from '../../host/types';

const npm = withMixin(
	'npm',
	Type.Intersect([
		CCommon.Npm,
		CCommon.LocalDir,
		Type.Partial(CServiceCommon.UnitFile),
		Type.Partial(CCommon.ConfigJson),
	]),
	flags, files, configJson,
)(Base => class extends Base {
	private npmCmdOpts: CmdOpts = {
		cwd: this.npmLocalSrcDir,
	};

	@action('build')
	@(action('install').optional('build'))
	@(action('sync').optional('build'))
	async npmBuild() {
		const hasBuild = await this.dirNotEmpty(this.npmLocalBuildDir, { local: true });
		if (hasBuild && !this.flagsIncludeExplicit('build')) {
			this.log('Build already exists, skipping build step');
			return;
		}

		await this.localCmd('npm', ['run', 'build'], this.npmCmdOpts);
	}

	@hook('sync.final', t => t.configJson && t.unitFileTemplate === 'client')
	async npmClientConfigJs() {
		const configPath = this.getConfigJsonFilePath();
		const config = await this.read(configPath);
		const js = `window.CONFIG = ${config}`;
		await this.write('public/config.js', js);
	}

	async npmDev(opts?: CmdOpts) {
		await this.localCmd('npm', ['run', 'dev'], {
			...this.npmCmdOpts,
			...opts,
		});
	}
});

export default npm;

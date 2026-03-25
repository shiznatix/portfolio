import { Type } from '@sinclair/typebox';
import { CCommon, CService } from '../configs';
import { withMixin } from '../mixin-factory';
import { action, hook } from '../annotations';
import docker from '../extensions/docker';
import prompt from '../common/prompt';
import files from '../common/files';

const actionSync = Symbol('dockerSync');
const actionBuild = Symbol('dockerBuild');
const hookInstallBegin = Symbol('docker.hookInstallBegin');
const hookInstallEnd = Symbol('docker.hookInstallEnd');

const runnerDocker = withMixin(
	'runnerDocker',
	Type.Intersect([
		CCommon.WorkDir,
		CService.Docker,
	]),
	docker, prompt, files,
)(Base => class extends Base {
	@hook('install.begin')
	async [hookInstallBegin]() {
		await this.dkrStop({
			noFail: true,
		});
	}
	@hook('install.end')
	async [hookInstallEnd]() {
		await this.dkrStart();
	}

	@action('sync', t => t.dockerComposeFile)
	async [actionSync]() {
		await this.write('docker-compose.yml', this.dockerComposeFile as string);
	}

	@(action('build').optional(['pull', 'build']))
	async [actionBuild]() {
		if (this.initiatingAction === 'build') {
			await this[hookInstallBegin]();
		}

		await this.dkrUpdate();

		if (this.initiatingAction === 'build') {
			await this[hookInstallEnd]();
		}
	}
});

export default runnerDocker;

import { Type } from '@sinclair/typebox';
import { CCommon } from '../configs';
import { action } from '../annotations';
import { withMixin } from '../mixin-factory';
import { CmdOpts } from '../../host/types';
import flags from '../common/flags';
import { CService } from '../configs';

const docker = withMixin(
	'docker',
	Type.Intersect([
		CService.Docker,
		CCommon.WorkDir,
	]),
	flags,
)(Base => {
	type C = typeof docker.Config;
	const nameFilter = ({ containerNames }: C) => containerNames ?? [];

	return class extends Base {
		private async dkrRunCommand(action: string, opts?: CmdOpts) {
			const cmd = `cd ${this.workDir} && docker compose ${action} ${this.flags.include.join(' ')}`.trim();

			return this.cmd(cmd, opts);
		}

		async dkrPs() {
			const res = await this.dkrRunCommand('ps -a --format json', {
				silent: true,
			});

			return res.stdout.split('\n').map(l => l.trim()).filter(l => l.startsWith('{')).map(l => JSON.parse(l));
		}

		@(action('test').filter(nameFilter))
		async dkrIsRunning(container?: string) {
			const statuses = await this.dkrPs();

			if (container) {
				return !!statuses.find(s => s.State === 'running' && s.Name === container);
			}

			return !statuses.find(s => s.State !== 'running');
		}

		@(action('start').filter(nameFilter))
		async dkrStart(opts?: CmdOpts) {
			await this.dkrRunCommand('up -d', opts);
		}

		@(action('status').filter(nameFilter))
		async dkrStatus() {
			const statuses = await this.dkrPs();

			console.table(statuses, ['Name', 'State', 'Status']);
		}

		@(action('logs').filter(nameFilter))
		async dkrLogs() {
			const flags = [
				`-n ${this.flags.number ?? 20}`,
			];

			if (this.flags.follow) {
				flags.push('-f');
			}

			await this.dkrRunCommand(`logs ${flags.join(' ')}`);
		}

		@(action('stop').filter(nameFilter))
		async dkrStop(opts?: CmdOpts) {
			await this.dkrRunCommand('down', opts);
		}

		@(action('restart').filter(nameFilter))
		async dkrRestart(opts?: CmdOpts) {
			// Since `docker compose restart` does not bring in changes to `docker-compose.yml`, we should stop then start again
			await this.dkrStop(opts);
			await this.dkrStart(opts);
		}

		async dkrUpdate(opts?: CmdOpts) {
			if (this.flagsInclude('pull')) {
				await this.dkrRunCommand('pull', opts);
			}

			if (this.flagsInclude('build')) {
				await this.dkrRunCommand('build --pull', opts);
			}
		}

		@action('uninstall')
		async dkrUninstall(opts?: CmdOpts) {
			await this.dkrStop(opts);
			await this.dkrRunCommand('rm', opts);
		}
	};
});

export default docker;

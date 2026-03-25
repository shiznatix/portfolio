import stripAnsi from 'strip-ansi';
import { CmdOpts, CmdOutput } from '../../host/types';
import { action } from '../annotations';
import { withMixin } from '../mixin-factory';
import flags from '../common/flags';
import { CService } from '../configs';

export const JOURNAL_SINCE_LAST_START = 'last-start';

const CMDS_WITHOUT_SERVICE_NAME = [
	'daemon-reload',
	'reset-failed',
];

type SystemdCommand =
	'daemon-reload' |
	'reset-failed' |
	'is-active' |
	'enable' |
	'start' |
	'status' |
	'stop' |
	'restart' |
	'disable';
type StartOpts = {
	waitRunning?: number | true;
};
type RetryOpts = {
	noRetry?: boolean;
};

const sysd = withMixin('sysd', CService.Sysd, flags)
(Base => class extends Base {
	private async sysdRunCommand(action: string, opts?: CmdOpts & StartOpts & RetryOpts): Promise<CmdOutput> {
		const prefix = this.unitOwner === 'system' ? 'sudo systemctl' : 'systemctl --user';
		const suffix = !CMDS_WITHOUT_SERVICE_NAME.includes(action) ? this.unitFileName : '';
		const cmd = `${prefix} ${action} ${suffix}`.trim();
		const res = await this.cmd(cmd, opts);

		if (res.code === 0 && opts?.waitRunning) {
			const waitTime = opts.waitRunning === true ? 10 : opts.waitRunning;
			this.log(`Waiting up to ${waitTime}s for service to be active...`);
			const isActiveCmd = `for i in $(seq 1 ${waitTime}); do ${prefix} is-active ${suffix} && break || sleep 1; done`;
			await this.cmd(isActiveCmd, opts);
		} else if (res.code == 0 && res.stdout.includes('systemctl daemon-reload')) {
			this.log(`Detected daemon-reload in output, reloading systemd daemon, retry: ${!opts?.noRetry}`);
			if (!opts?.noRetry) {
				await this.sysdReload(opts);
				await this.sysdRunCommand(action, { ...opts, noRetry: true });
			}
		}

		return res;
	}

	async sysdRun(action: SystemdCommand, opts?: CmdOpts) {
		return await this.sysdRunCommand(action, opts);
	}

	async sysdIsRunning(opts?: CmdOpts) {
		const res = await this.sysdRunCommand('is-active --quiet', { ...opts, noFail: true });
		return res.code === 0;
	}

	@action('status')
	async sysdStatus() {
		// always run this status command so we can see the output in terminal, even if the service isn't running
		const { code: statusCode } = await this.sysdRunCommand(`status --no-pager --lines=0`, {
			noFail: true,
		});
		const { code: activeCode } = await this.sysdRunCommand(`is-active`, {
			noFail: true,
		});

		if (statusCode !== 0 || activeCode !== 0) {
			throw new Error(`Service ${this.unitName} is not active or not loaded`);
		}
	}

	@action('start')
	async sysdStart(opts?: CmdOpts & StartOpts) {
		await this.sysdRunCommand('start', opts);
	}

	@action('stop')
	async sysdStop(opts?: CmdOpts) {
		await this.sysdRunCommand('stop', opts);
	}

	@action('restart')
	async sysdRestart(opts?: CmdOpts & StartOpts & { force?: boolean; }) {
		if (opts?.force) {
			return await this.sysdRunCommand('restart', opts);
		}

		const running = await this.sysdIsRunning(opts);

		if (running) {
			await this.sysdRunCommand('restart', opts);
		} else {
			this.log.warn(`Won't restart ${this.unitName}, not currently running`);
		}
	}

	@action('enable', t => t.unitInstallable)
	async sysdEnable(opts?: CmdOpts) {
		await this.sysdRunCommand('enable', opts);
	}

	@action('disable', t => t.unitInstallable)
	async sysdDisable(opts?: CmdOpts) {
		await this.sysdRunCommand('disable', opts);
	}

	async sysdReload(opts?: CmdOpts) {
		await this.sysdRun('daemon-reload', opts);
	}

	async sysdResetFailed(opts?: CmdOpts) {
		await this.sysdRun('reset-failed', opts);
	}

	@(action('logs').flag(['follow', 'number', 'start', 'end']))
	async sysdLogs(overrides?: { follow?: boolean; start?: string; end?: string; }) {
		const logsConfig = this.journalOpts || {};
		const postfixFlags = logsConfig.postfixFlags || [];
		const postCommand = logsConfig.postCommand || '';
		const flags = [
			`-n ${this.flags.number ?? 50}`,
			'--no-pager',

			// '--output cat',
			'--output short',
			'--no-hostname',
			// '--output json',
		];
		const follow = overrides?.follow ?? this.flags.follow;
		const start = overrides?.start ?? this.flags.start;
		const end = overrides?.end ?? this.flags.end;
		let noFail = !!follow;

		if (follow && !postfixFlags.includes('-f')) {
			flags.push('-f');
		}
		if (start) {
			let since = start;
			if (since === JOURNAL_SINCE_LAST_START) {
				// strip unicode chars cause systemd can output silly things sometimes
				since = stripAnsi((await this.sysdRunCommand(`show -p ActiveEnterTimestamp --value`, {
					noFail: true,
				})).stdout).trim();
			}

			if (since) {
				flags.push(`--since "${since}"`);
			}
		}
		if (end) {
			flags.push(`--until "${end}"`);
		}

		flags.push(...(Array.isArray(postfixFlags) ? postfixFlags : [postfixFlags]));
		const postCommandStr = postCommand ? `| ${postCommand}` : '';

		await this.cmd(`journalctl ${flags.join(' ')} -u ${this.unitName} | sed -u -E 's/^[A-Za-z]{3} [0-9]{1,2} ([0-9]{2}:[0-9]{2}:[0-9]{2}) [^:]+:/\\1:/' ${postCommandStr}`, {
			noTrim: true,
			noFail,
		});
	}
});

export default sysd;

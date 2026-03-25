import { spawn } from 'child_process';
import os from 'os';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { CmdOpts, CmdOutput, HostConfig, HostDnsRecord } from './types';
import { CmdError, HostOfflineError, SkippableError } from '../../errors';
import { abortSignal } from '../../abort-controller';
import type { ServiceName, Services } from '../../inventory/services';
import { ArgvFlags } from '../../types';
import logger, { LoggerInstance } from '../../logger';
import { getService } from '../../inventory/services';
import { camelToKebab } from '../../utils';
import { getGroupServices } from '../../inventory/host-groups';

export default class Host<N extends string = string> {
	readonly name: N;
	readonly hostIsLocal: boolean;
	readonly config: HostConfig;
	readonly services: Record<string, any>;
	readonly serviceCache = new Map<string, unknown>();
	private readonly log: LoggerInstance;
	private argvFlags: ArgvFlags = {
		include: [],
		skip: [],
		child: [],
		number: null,
		start: null,
		end: null,
		nofail: false,
		follow: false,
		reboot: false,
		verbose: false,
		force: false,
		dryrun: false,
		noprompt: false,
	};

	constructor(name: N, config: HostConfig) {
		this.name = name;
		this.config = config;

		// Add group-based services
		const groupBasedServices = getGroupServices(config.groups);
		const allServices = { ...groupBasedServices, ...config.services };

		this.services = Object.keys(allServices).reduce((acc, curr) => {
			acc[camelToKebab(curr)] = allServices[curr as ServiceName];
			return acc;
		}, {} as Record<string, any>);
		this.hostIsLocal = os.hostname() === this.name;
		this.log = logger({
			name: `host:${this.name}`,
		});
	}

	get username() {
		return this.config.username;
	}
	get ip() {
		return this.config.ip;
	}
	get dns(): HostDnsRecord[] {
		return [
			{ name: this.name, ip: this.ip },
			...(this.config.extraDns || []),
		];
	}
	get drives() {
		return this.config.drives;
	}
	get groups() {
		return this.config.groups;
	}
	get serviceNames() {
		return Object.keys(this.services) as string[];
	}

	setArgvFlags(flags: ArgvFlags) {
		this.argvFlags = flags;
		this.serviceCache.clear();
	}

	hasService(name: ServiceName) {
		return Object.keys(this.services).includes(name);
	}

	props<S extends ServiceName>(name: S) {
		return this.services[name] || {};
	}

	service<S extends ServiceName>(name: S) {
		if (this.serviceCache.has(name as string)) {
			const inst = this.serviceCache.get(name as string);
			return inst as Services<S>;
		}

		const props = this.props(name);
		const serviceBuilder = getService(name);
		const service = new (serviceBuilder(this, props, this.argvFlags));
		this.serviceCache.set(name as string, service);
		return service as Services<S>;
	}

	localCmd(cmd: string, args: string[] = [], opts: CmdOpts = {}): Promise<CmdOutput> {
		return new Promise((accept, reject) => {
			let stdout = '';
			let stderr = '';

			const log = (opts.logger || this.log).extend({ noSymbol: true }).inc().inc();
			const logg = {
				v: log.extend({ name: '↬', style1: chalk.yellowBright, style2: chalk.bgHex('#2c2c2c') }),
				vv: log.extend({ name: '↬↬', style1: chalk.blueBright, style2: chalk.dim.italic.yellowBright }).inc().inc().verbose,
				i: log.extend({ name: '⇜', style1: chalk.greenBright, style2: chalk.hex('#ADADAD') }).inc(),
				e: log.extend({ name: '🔺', style1: chalk.reset, style2: chalk.hex('#b83939d3') }).inc(),
			};

			logg.v(cmd, args.join(' '));
			logg.vv(opts.caller || 'caller unknown');

			if (opts.dryRun) {
				logg.vv('Dry run enabled, skipping command execution.');
				return accept({
					code: 0,
					stdout: '',
					stderr: '',
				});
			}

			const exitOnStrs = [
				...(opts.exitOnStr ? (Array.isArray(opts.exitOnStr) ? opts.exitOnStr : [opts.exitOnStr]) : []),
			];
			const promptSearchLineEnd = opts.inputOnPrompt ? opts.inputOnPrompt.lineEnd : null;
			const promptInput = opts.inputOnPrompt ? opts.inputOnPrompt.input : null;
			const proc = spawn(cmd, args, {
				cwd: opts.cwd,
				timeout: opts.timeoutSec ? opts.timeoutSec * 1000 : opts.timeoutSec,
				signal: abortSignal,
			});
			proc.on('error', (err: NodeJS.ErrnoException) => {
				if (err.code === 'ABORT_ERR') {
					process.stdin.removeListener('data', write);
					return reject(new SkippableError('Abort signal received', true));
				}
				reject(err);
			});
			const write = (data: Buffer) => {
				const strData = `${data.toString().trim()}\r\n`;
				proc.stdin.write(strData);
			};
			const forceExit = () => {
				if (stdout.includes('No route to host') || stderr.includes('No route to host')) {
					proc.kill('SIGINT');
					return reject(new HostOfflineError('No route to host'));
				}
				for (const str of exitOnStrs) {
					if (stdout.includes(str) || stderr.includes(str)) {
						proc.kill('SIGINT');
						break;
					}
				}
			};
			const logOut = (log: LoggerInstance, s: string) => {
				if (opts.stdCallback) {
					opts.stdCallback(s);
				}

				if (opts.silent) {
					return;
				}

				const lines = stripAnsi(s)
					.replaceAll('\r', '.')
					.split('\n')
					.map(l => opts.noTrim ? l : l.trim())
					.filter(l => l);

				for (const l of lines) {
					log(l);
				}
			};

			process.stdin.on('data', write);
			proc.stdout.on('data', (chunk) => {
				const c: string = chunk.toString('utf8');
				stdout = `${stdout}${c}`;

				if (promptSearchLineEnd && promptInput && c.split('\n').find(l => l.includes(promptSearchLineEnd))) {
					write(Buffer.from(promptInput));
				}

				logOut(logg.i, c);
				forceExit();
			});
			proc.stderr.on('data', (chunk) => {
				const c = chunk.toString('utf8');
				stderr = `${stderr}${c}`;
				logOut(logg.e, c);
				forceExit();
			});

			proc.on('exit', (exitRes: number | null, signal: string | null) => {
				process.stdin.removeListener('data', write);

				if (abortSignal.aborted) {
					return reject(new SkippableError('Abort signal received', true));
				}

				const code = (exitRes === null ? signal : exitRes) as number | string;

				if ((exitRes && exitRes > 0) || signal) {
					if (!opts.noFail) {
						const err = new CmdError(`Exit status ${code}`, stdout, stderr, code);

						return reject(err);
					}
				}

				return accept({
					code,
					stdout,
					stderr,
				});
			});
		});
	}

	sshCmd(cmd: string, opts?: CmdOpts): Promise<CmdOutput> {
		const username = opts?.destHost?.username || this.username;
		const host = opts?.destHost?.ip || this.ip;
		return this.localCmd('ssh', ['-tt', `${username}@${host}`, cmd], opts);

	}

	async cmd(cmd: string, opts?: CmdOpts): Promise<CmdOutput> {
		if (this.hostIsLocal || opts?.local) {
			return this.localCmd('sh', ['-c', cmd], opts);
		} else {
			return this.sshCmd(cmd, opts);
		}
	}
}

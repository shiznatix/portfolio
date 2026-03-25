import fs from 'fs';
import { execSync } from 'child_process';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { getHostKeys, getHostNames, getHosts, hostExists, HostKey, HostName } from './inventory/hosts';
import { ServiceName } from './inventory/services';
import { serviceInstallOrder } from './inventory/service-install-order';
import { Action, Flag, FlagBoolean, FlagsOpts } from './core/service/annotations/types';
import { arrayUnique } from './utils';
import { Argv } from './types';
import chalk from 'chalk';
import { JOURNAL_SINCE_LAST_START } from './core/service/extensions/sysd';

class ArgvValidationError extends Error {}

const globalActions: Action[] = [
	'install', 'start', 'stop', 'restart', 'uninstall',
	'backup', 'sync',  'status', 'disable', 'enable', 'urls',
	'sudo',
];
const globalFlags: FlagBoolean[] = ['nofail', 'verbose', 'dryrun', 'noprompt'];
const globalFlagsOpts = globalFlags.reduce<FlagsOpts>((acc, curr) => {
	return Object.assign(acc, {
		[curr]: true,
	});
}, {});

const scriptName = 'mm';
const argv = yargs(hideBin(process.argv))
	.scriptName(scriptName)
	.version(false)
	.usage(`${scriptName} <host> <service> <action>`)
	.command('$0', 'Run a command for a service on a host')
	.command('completion', 'Output/install the completion script with fixes',
		(yargs) => yargs
			.option('install', {
				type: 'boolean',
				describe: 'Install the completion script to your system',
				default: false,
			})
			.option('default', {
				type: 'boolean',
				describe: 'Use the default completion script without modifications',
				default: false,
			}),
		(argv) => {
			const originalWrite = process.stdout.write;
			let output = '';
			process.stdout.write = (chunk: any) => {
				output += chunk;
				return true;
			};
			yargs().scriptName(scriptName).showCompletionScript();
			process.stdout.write = originalWrite;

			const script = argv.default
				? output
				: output.replace(
					/else\s+_default\s+fi/,
					'else\n    return 0\n  fi'
				);

			if (argv.install) {
				const zshrcPath = `${process.env.HOME}/.zshrc`;
				const startMarker = '#compdef mm';
				const endMarker = '###-end-mm-completions-###';
				const sedCmd = `sed -i '/${startMarker}/,/${endMarker}/d' ${zshrcPath}`;

				execSync(sedCmd, { stdio: 'inherit' }); // remove old (if existed)
				fs.appendFileSync(zshrcPath, script); // add new

				console.log('✓ Completion installed to ~/.zshrc');
				console.log('Run: source ~/.zshrc');
			} else {
				console.log(script);
			}
			process.exit(0);
		}
	)
	.positional('host', { alias: 'group', type: 'string' })
	.positional('service', { type: 'string' })
	.positional('action', { type: 'string' })
	.option('skip',      { alias: 's', type: 'array' })
	.option('include',   { alias: 'i', type: 'array' })
	.option('child',     { alias: 'c', type: 'array' })
	.option('number',    { alias: 'n', type: 'number' })
	.option('start',     { alias: 'S', type: 'string' })
	.option('end',       { alias: 'E', type: 'string' })
	.option('nofail',    { alias: 'x', type: 'boolean', default: false })
	.option('follow',    { alias: 'f', type: 'boolean', default: false })
	.option('reboot',    { alias: 'r', type: 'boolean', default: false })
	.option('verbose',   { alias: 'v', type: 'boolean', default: false })
	.option('force',     { aliad: 'F', type: 'boolean', default: false })
	.option('dryrun',    { alias: 'd', type: 'boolean', default: false })
	.option('noprompt',  { alias: 'y', type: 'boolean', default: false })
	.completion('completion', (current, argv) => {
		const args: string[] = argv._.slice(1);
		const compLine = process.env.COMP_LINE || '';
		const hasTrailingSpace = compLine.endsWith(' ');
		current = args.length === 0 && current === scriptName ? '' : current;
		current = hasTrailingSpace ? '' : current;
		const dashIndex = compLine.indexOf(' -');
		const flagsPart = dashIndex >= 0 ? compLine.slice(dashIndex + 1) : '';
		const compLineFlags = flagsPart ? flagsPart.split(/\s+/) : [];
		args.push(...compLineFlags.filter(l => l.trim()));
		const argsCount = hasTrailingSpace ? args.length : Math.max(0, args.length - 1);

		// const debug: Record<string, unknown> & { save: CallableFunction } = {
		// 	_: argv, args, current, compLine, hasTrailingSpace, argsCount,
		// 	save() {
		// 		fs.writeFileSync(`${__dirname}/../../debug.json`, JSON.stringify(this, null, 2));
		// 	},
		// };
		// debug.save();

		const csvNames = (possible: string[]) => {
			const parts = current.split(',');
			const curr = parts.slice(0, -1);
			const prefix = (curr.length > 0 ? [...curr, ''] : []).join(',');
			const available = possible.filter(n => !curr.includes(n));
			return available.map(n => `${prefix}${n}`);
		};

		if (argsCount === 0) {
			return csvNames(getHostKeys() as HostKey[]);
		} else if (argsCount === 1) {
			const hostNames = args[0].split(',') as HostKey[];
			const hosts = getHosts(hostNames);
			return csvNames(arrayUnique(hosts.map(h => h.serviceNames).flat()));
		} else if (argsCount === 2) {
			const hostNames = args[0].split(',') as HostKey[];
			const serviceNames = args[1].split(',') as ServiceName[];
			const hosts = getHosts(hostNames);
			return csvNames(arrayUnique(serviceNames.map(s => hosts
				.filter(h => h.hasService(s))
				.map(h => h.service(s).allActionNames())
			).flat(2)));
		} else if (argsCount >= 3) {
			const hostNames = args[0].split(',') as HostKey[];
			const serviceNames = args[1].split(',') as ServiceName[];
			const actionNames = args[2].split(',') as Action[];
			const hosts = getHosts(hostNames);
			const flagsOpts = serviceNames.reduce((acc, curr) => {
				const actionFlags = actionNames.map(a => hosts
					.filter(h => h.hasService(curr))
					.map(h => h.service(curr).flagsWithOpts(a))
				).flat(2);

				for (const flagsOpts of actionFlags) {
					for (const [f, opts] of Object.entries(flagsOpts)) {
						const flag = f as Flag;
						acc[flag] = Array.isArray(opts)
							? arrayUnique([...(Array.isArray(acc[flag]) ? acc[flag] : []), ...opts])
							: opts;
					}
				}

				return acc;
			}, globalFlagsOpts);
			const aliases = Object.keys(flagsOpts).reduce((acc, curr) => {
				const full = `--${curr}`;
				acc[full] = curr;
				acc[`--${curr[0]}`] = curr;
				acc[`-${curr[0]}`] = curr;
				acc[curr] = full;
				return acc;
			}, {} as Record<string, string>);
			const prevIsFlag = args[args.length - 2].startsWith('-');
			const curIsFlag = args[args.length - 1].startsWith('-');
			const lastFlag = args.filter(arg => arg.startsWith('-')).pop() || null;
			const curFlagName = (lastFlag && aliases[lastFlag]
				? aliases[lastFlag]?.replace(/^-{1,2}/, '')
				: null
			) as Flag | null;
			const availableFlags = Object.entries(flagsOpts).reduce((acc, [n, opts]) => {
				const name = n as Flag;
				const setOpts = argv[name];

				if (Array.isArray(opts)) {
					const unsetOpts = opts.filter(opt => !setOpts?.includes(opt) || opt === current);
					if (unsetOpts.length > 0) {
						acc[name] = unsetOpts;
					}
				} else {
					const setCount = args.filter(p => aliases[p] === name).length;
					if (!setOpts || (setCount === 1 && aliases[current] === name)) {
						acc[name] = opts;
					}
				}

				return acc;
			}, {} as FlagsOpts);
			const availableOpts = curFlagName && availableFlags[curFlagName];

			return (Array.isArray(availableOpts) && ((curIsFlag && hasTrailingSpace) || (prevIsFlag && !hasTrailingSpace)))
				? availableOpts
				: Object.keys(availableFlags).map(f => aliases[f as Flag]);
		}
	})
	.demandCommand(1)
	.showHelpOnFail(false)
	.fail((msg, err, _yargs) => {
		console.error('');
		console.error(chalk.red(err || msg));
		if (err && !(err instanceof ArgvValidationError)) {
			console.error(err.stack);
		}
		process.exit(1);
	})
	.check((argv, _options) => {
		const pos = argv._;

		// TODO - if globalAction === 'restart' then expand it to only be `system`
		// TODO -   make some shortcut for "is host alive"

		// Special handling: if pos[1] is a global action and pos[2] is empty, expand to serviceInstallOrder
		if (pos[0] && pos[1] && globalActions.includes(pos[1] as Action) && !pos[2]) {
			const argHosts = (pos[0] as string).split(',') as HostName[];
			if (!argHosts.every(h => hostExists(h))) {
				throw new ArgvValidationError(`<host> must be one of "${getHostNames().join(', ')}"}`);
			}
			const hosts = getHosts(argHosts);
			const hostServices = arrayUnique(hosts.flatMap(h => h.serviceNames));
			const filteredServices = serviceInstallOrder.filter(serviceName => hostServices.includes(serviceName));
			pos[2] = pos[1];
			pos[1] = filteredServices.join(',');
		}

		const [h, s, a] = pos;
		const argHosts = (h as string)?.split(',') as HostName[];
		const argServices = (s as string)?.split(',') as ServiceName[];
		const argActions = (a as string)?.split(',') as Action[];

		if (pos.length !== 3 || !h || !s || !a) {
			throw new ArgvValidationError('Exactly 3 positional arguments required');
		}

		if (!argHosts.every(h => hostExists(h))) {
			throw new ArgvValidationError(`<host> must be one of "${getHostNames().join(', ')}"`);
		}

		const hosts = getHosts(argHosts);
		const allHostsServices = arrayUnique(hosts.map(h => h.serviceNames).flat());
		if (!argServices.every(s => allHostsServices.includes(s))) {
			throw new ArgvValidationError(`<service> must be one of "${allHostsServices.join(', ')}"`);
		}

		if (argv.follow && !argActions.includes('logs')) {
			argActions.push('logs');
			argv.start = argv.start || JOURNAL_SINCE_LAST_START;
		}

		const allServicesActions = arrayUnique(argServices.map(n => hosts
			.filter(h => h.hasService(n))
			.map(h => h.service(n).allActionNames())
		).flat(2));
		if (argActions.every(a => !allServicesActions.includes(a))) {
			throw new ArgvValidationError(`Command must be one of "${allServicesActions.join(', ')}"`);
		}

		argv.hosts = argHosts;
		argv.services = argServices;
		argv.actions = argActions;

		return true;
	})
	.parse();

export default argv as unknown as Argv;

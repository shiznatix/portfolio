import 'source-map-support/register';
import chalk from 'chalk';
import { getHosts, setHostsArgvFlags } from './inventory/hosts';
import argv from './argv';
import { SkippableError } from './errors';

type ServiceStats = {
	timeSec: number;
	result: string;
};
type ServiceError = {
	hostName: string;
	ip: string;
	serviceName: string;
	action: string;
	error: unknown;
};
type HostStats = {
	[key: string]: unknown;
};

async function main() {
	setHostsArgvFlags({
		include: argv.include || [],
		skip: argv.skip || [],
		child: argv.child || [], // stack-service
		number: argv.number || null,
		nofail: !!argv.nofail,
		follow: !!argv.follow,
		start: argv.start || null,
		end: argv.end || null,
		reboot: !!argv.reboot,
		verbose: !!argv.verbose,
		force: !!argv.force,
		dryrun: !!argv.dryrun,
		noprompt: !!argv.noprompt,
	});

	const hosts = getHosts(argv.hosts);
	const serviceNames = argv.services;
	const actions = argv.actions;

	const stats: HostStats[] = [];
	const errors: ServiceError[] = [];

	let exitCode = 0;

	const results = await Promise.allSettled(hosts.map(async host => {
		const stats: HostStats[] = [];
		const errors: ServiceError[] = [];

		for (const serviceName of serviceNames) {
			const serviceEntry: HostStats = {
				name: host.name,
				ip: host.ip,
				service: serviceName,
			};
			for (const action of actions) {
				const startTime = new Date().getTime();
				const serviceStats: ServiceStats = {
					timeSec: -1,
					result: '',
				};

				try {
					if (!host.hasService(serviceName)) {
						serviceStats.result = '🚧';
					} else {
						await host.service(serviceName).startAction(action);
						serviceStats.result = `✅`;
					}
				} catch (error) {
					const isSkippable = error instanceof SkippableError;

					if (isSkippable && error.silent) {
						serviceStats.result = `⚠️`;
					} else {
						if (error instanceof Error) {
							console.error(error.message);
						}

						exitCode = 1;
						serviceStats.result = `❌`;
					}

					if (!isSkippable) {
						errors.push({
							hostName: host.name,
							ip: host.ip,
							serviceName,
							action,
							error,
						});
					}
				}

				const endTime = new Date().getTime();
				serviceStats.timeSec = Math.round((endTime - startTime) / 1000);
				serviceEntry[action] = `${serviceStats.timeSec}s ${serviceStats.result}`;
			}
			stats.push(serviceEntry);
		}

		return { stats, errors };
	}));

	for (const result of results) {
		if (result.status === 'fulfilled') {
			stats.push(...result.value.stats);
			errors.push(...result.value.errors);
		} else {
			console.error(chalk.bgRedBright(`❌❌❌ Unhandled error from host: ${(result.reason as Error).message} ❌❌❌`));
		}
	}

	if (errors.length) {
		for (const error of errors) {
			console.error(chalk.red(`${error.hostName} - ${error.ip} - ${error.serviceName} - ${error.action}`));
			// console.error(chalk.red(error.error));
			console.error(error.error);
		}
	}

	console.log(chalk.whiteBright.bold('\n\n-------------------------RESULTS-------------------------'));
	console.table(stats);

	process.exit(exitCode);
}

main();

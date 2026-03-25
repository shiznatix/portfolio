import chalk from 'chalk';
import { withMixin } from '../mixin-factory';
import { action, actionManager } from '../annotations';
import { prettyJson } from '../../../utils';
import flags from '../common/flags';
import files from '../common/files';
import { TriggerOpts } from '../service-types';

const managerInstall = Symbol('managerInstall');
const managerSync = Symbol('managerSync');
const managerUninstall = Symbol('managerUninstall');

const runnerBase = withMixin('runnerBase', flags, files)(Base => class extends Base {
	@actionManager('install')
	async [managerInstall](opts?: TriggerOpts) {
		await this.triggerHook('install.begin', opts);
		await this.triggerAction('install', opts);
		await this.triggerHook('install.sync.begin', opts);
		await this.triggerAction('sync', opts);
		await this.triggerHook('install.sync.end', opts);
		await this.triggerAction('build', opts);
		await this.triggerHook('install.end', opts);
		await this.triggerHook('install.final', opts);
	}

	@actionManager('sync')
	async [managerSync](opts?: TriggerOpts) {
		await this.triggerHook('sync.begin', opts);
		await this.triggerAction('sync', opts);
		await this.triggerHook('sync.end', opts);
		await this.triggerHook('sync.final', opts);
	}

	@actionManager('uninstall')
	async [managerUninstall](opts?: TriggerOpts) {
		opts = { ...opts, noFail: true };
		await this.triggerHook('uninstall.begin', opts);
		await this.triggerAction('uninstall', opts);
		await this.triggerHook('uninstall.end', opts);
		await this.triggerHook('uninstall.final', opts);
	}

	@(action('debug').required('this'))
	baseDebugThis() {
		this.log(chalk.bold(`--- Service "${this.name}" this ---`));
		this.log(prettyJson(this));
		this.log(chalk.bold(`--- /Service "${this.name}" this ---`));
	}

	@(action('debug').required('config'))
	baseDebugConfig() {
		this.log(chalk.bold(`--- Service "${this.name}" Config ---`));
		this.log(prettyJson(Base.prototype.constructor.__config));
		this.log(chalk.bold(`--- /Service "${this.name}" Config ---`));
	}

	@(action('debug', t => t.hasProps()).required('props'))
	baseDebugProps() {
		this.log(chalk.bold('--- Service Props ---'));
		this.log(prettyJson(this.props));
		this.log(chalk.bold('--- /Service Props ---'));
	}

	@(action('debug').required(['mixins', 'mixins-set', 'mixins-disabled']))
	baseDebugMixins() {
		const mixinResults = Base.prototype.constructor.__mixins;
		const onlySet = this.flagsIncludeExplicit('mixins-set');
		const mixins = this.flagsIncludeExplicit('mixins')
			? mixinResults
			: Object.fromEntries(
				Object.entries(mixinResults).filter(([, v]) => onlySet ? v === true : v !== true)
			);

		this.log(chalk.bold('--- Service Mixins ---'));
		this.log(prettyJson(mixins));
		this.log(chalk.bold('--- /Service Mixins ---'));
	}

	@(action('debug').required('triggers'))
	baseDebugTriggers() {
		this.log(chalk.bold('--- Registered Triggers ---'));
		const triggers = {
			install: {
				actionManager: this.triggerHandlers('actionManager', 'install'),
				actions: this.triggerHandlers('action', 'install'),
				'install.begin': this.triggerHandlers('hook', 'install.begin'),
				'install.sync.begin': this.triggerHandlers('hook', 'install.sync.begin'),
				'install.sync.end': this.triggerHandlers('hook', 'install.sync.end'),
				'install.end': this.triggerHandlers('hook', 'install.end'),
			},
			sync: {
				actionManager: this.triggerHandlers('actionManager', 'sync'),
				actions: this.triggerHandlers('action', 'sync'),
				'sync.begin': this.triggerHandlers('hook', 'sync.begin'),
				'sync.end': this.triggerHandlers('hook', 'sync.end'),
			},
			uninstall: {
				actionManager: this.triggerHandlers('actionManager', 'uninstall'),
				actions: this.triggerHandlers('action', 'uninstall'),
				'uninstall.begin': this.triggerHandlers('hook', 'uninstall.begin'),
				'uninstall.end': this.triggerHandlers('hook', 'uninstall.end'),
			},
			debug: this.triggerHandlers('action', 'debug'),
			allActions: this.allActionNames().join(', '),
		};
		this.log(prettyJson(triggers));
		this.log(chalk.bold('--- /Registered Triggers ---'));
	}

	@action('urls')
	async baseShowUrls() {
		this.log(chalk.bold(`--- URLs for "${this.name}" on "${this.host.name}" (${this.host.ip}) ---`));

		const portsObj = this.ports?.();
		if (!portsObj || Object.keys(portsObj).length === 0) {
			this.log(chalk.yellow('No ports defined for this service'));
			this.log(chalk.bold('--- /URLs ---'));
			return;
		}

		// Try to show default URL (usually http port)
		const portNames = Object.keys(portsObj) as (keyof typeof portsObj)[];
		const hasHttpPort = portNames.some(p => String(p) === 'http');
		if (hasHttpPort) {
			try {
				const defaultUrl = this.url();
				this.log(chalk.green('Default URL: ') + chalk.cyan(defaultUrl));
			} catch {
				// Could not build default URL
			}
		}

		this.log('');
		this.log(chalk.bold('All ports:'));

		// Show all ports with their URLs
		for (const portName of portNames) {
			const portNum = portsObj[portName];
			try {
				const url = this.url({ port: portName as any });
				this.log(`  ${chalk.yellow(String(portName).padEnd(15))} ${chalk.cyan(url)} ${chalk.dim(`(port ${portNum})`)}`);
			} catch (err) {
				this.log(`  ${chalk.yellow(String(portName).padEnd(15))} ${chalk.dim(`port ${portNum}`)}`);
			}
		}

		this.log(chalk.bold('--- /URLs ---'));
	}
});

export default runnerBase;

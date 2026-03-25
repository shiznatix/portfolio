import { Type } from '@sinclair/typebox';
import chokidar from 'chokidar';
import { CCommon } from '../configs';
import { action } from '../annotations';
import abortController, { abortSignal, shutdown } from '../../../abort-controller';
import { withMixin } from '../mixin-factory';
import { CService } from '../configs';
import { TriggerOpts } from '../service-types';
import npm from './npm';
import sysd from './sysd';
import chalk from 'chalk';

const dev = withMixin(
	'dev',
	Type.Intersect([
		CCommon.Dev,
		CCommon.WorkDir,
		CCommon.LocalDir,
		Type.Partial(CCommon.Python),
		Type.Partial(CCommon.Npm),
		Type.Partial(CCommon.ServiceTemplate),
		Type.Partial(CService.Sysd),
	]),
	npm, sysd,
)(Base => class extends Base {
	private pythonDepFiles = [
		'pyproject.toml',
		'requirements.txt',
	];
	private changedPaths = new Set<string>();
	private syncing = false;
	private ready = false;

	private async errorHandler() {
		abortController.abort();
		if (!this.ready) {
			await shutdown();
		}
	};
	private async changeHandler({ restartIfRunning = true, throwOnError = false } = {}) {
		if (this.syncing) {
			this.log.warn('Change detected but already syncing, skipping this change');
			return;
		}

		try {
			this.syncing = true;
			this.clearTriggerCache();

			if (this.devOnChange) {
				await this.devOnChange([...this.changedPaths]);
			} else {
				const opts: TriggerOpts = this.changedPaths.size ? { disableHooks: 'symboled' } : {};
				const hasDepUpdate = [...this.changedPaths].some(p => this.pythonDepFiles.some(f => p.endsWith(f)));

				await this.triggerAction('sync', opts);
				if (hasDepUpdate) {
					await this.triggerAction('stop', opts);
					await this.triggerAction('deps', opts);
					await this.triggerAction('start', opts);
				}

				const isRunning = this.kind === 'sysd'
					? await this.sysdIsRunning()
					: null;

				if (isRunning === false) {
					await this.triggerAction('start', opts);
				} else if (isRunning === null || restartIfRunning) {
					await this.triggerAction('restart', opts);
				}
			}

			this.syncing = false;
			this.changedPaths.clear();
		} catch (error) {
			this.log(`Error during dev onChange handling: ${(error as Error).message}`);
			await this.errorHandler();
			if (throwOnError) {
				throw error;
			}
		}
	};
	private defaultCheckPath(path: string) {
		if (this.isNpm) {
			return path.startsWith(this.npmLocalBuildDir!)
				|| (this.unitFileName && path.endsWith(this.unitFileName))
				|| false;
		} else if (this.isPython)	{
			return path.startsWith(`${this.localDir}/src`)
				|| path.startsWith(`${this.localDir}/.rhpy`)
				|| path.startsWith(`${this.localDir}/server/src`)
				|| path.startsWith(`${this.localDir}/server/.rhpy`)
				|| this.pythonDepFiles.some(f => path.endsWith(f))
				|| (this.unitFileName && path.endsWith(this.unitFileName))
				|| false;
		}
		return path.startsWith(this.localDir);
	};

	@action('dev')
	protected async devWatch() {
		this.log('⌛ Starting dev mode...');
		const procs = [];

		await this.changeHandler({ throwOnError: true });

		if (this.serviceTemplate === 'client') {
			procs.push(this.npmDev({
				stdCallback: async l => {
					if (l.includes('built in')) {
						this.ready = true;
						await this.changeHandler({ restartIfRunning: false });
						this.log('-------- Client URL: --------');
						this.log(`  ${this.url()}`);
						this.log('-----------------------------');
					}
				},
			}));
		} else {
			const checkPath = this.devCheckPath?.bind(this) || this.defaultCheckPath.bind(this);
			const onReadyCmd = this.devStartProcess
				? this.devStartProcess.bind(this)
				: this.isPython
					? async () => {
						this.clearTriggerCache();
						await this.triggerAction('deps');
					}
					: null;
			procs.push(this.devWatchFiles(checkPath, onReadyCmd));
		}

		if (this.kind === 'sysd') {
			procs.push(this.sysdLogs({
				follow: true,
				start: 'now',
			}));
		}

		this.log(chalk.bold.overline.underline('⌨  Dev mode started  ⌨  '));
		await Promise.allSettled(procs);
		this.log(chalk.bold.overline.underline('🛠  🛠  Dev mode exited  🛠  🛠 '));
	}

	// async dev() {
	// 	const checkPath = () => true;
	// 	const onChange = async () => {
	// 		await this.sync();
	// 		await this.dockerCmd('build');
	// 		await this.restart();
	// 	};
	// 	const logsProc = this.logs('-f');

	// 	await this.devWatchFiles(checkPath, onChange);
	// 	await logsProc;
	// }

	protected async devWatchFiles(checkPath: (path: string) => boolean, onReadyCmd: (() => Promise<void>) | null = null) {
		return new Promise(async (accept) => {
			let notifyTimeout: NodeJS.Timeout | null = null;
			const watcher = chokidar.watch(this.localDir, {
				ignored: [
					/(^|[\/\\])\.(?!rhpy)/, // dotfiles (except .rhpy)
					/node_modules/, // node_modules
				],
			});
			watcher.on('ready', () => {
				this.ready = true;
				this.log(`File watching ready for ${this.name} ${this.localDir}`);
				if (onReadyCmd) {
					void onReadyCmd().catch(() => this.errorHandler());
				}
			});
			watcher.on('all', async (_, path) => {
				if (!this.ready || !checkPath(path)) {
					return;
				}

				this.changedPaths.add(path);

				if (notifyTimeout) {
					clearTimeout(notifyTimeout);
				}

				notifyTimeout = setTimeout(() => {
					this.log(`File change detected for ${this.name} path ${path}`);
					void this.changeHandler();
				}, 1000);
			});

			while (true) {
				if (abortSignal.aborted) {
					this.log('Received abort signal, cleanining up dev file watchers')
					if (notifyTimeout) {
						clearTimeout(notifyTimeout);
					}

					await watcher.close();
					accept(true);
					return;
				}

				await new Promise(a => setTimeout(a, 50));
			}
		});
	}
});

export default dev;

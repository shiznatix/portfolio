import { Type } from '@sinclair/typebox';
import { CCommon } from '../configs';
import { action } from '../annotations';
import { withMixin } from '../mixin-factory';

const GLOBAL_IGNORES = [
	// general
	'.vscode',
	// git
	'.git',
	'.gitignore',
	// node
	'node_modules',
	// python
	'.venv/',
	'venv/',
	'__snapshots__',
	'__pycache__',
	'user-settings', // default settings dir for rhpy
	'*_unittest.py.',
	'*.egg-info',
	'*.pyc',
	'uv.lock', // lock file will be set depending on host arch
	// sysd files, managed by `unit-file` mixin
	'*.service',
	'*.timer',
];

const rsync = withMixin('rsync', Type.Intersect([
	CCommon.WorkDir,
	CCommon.LocalDir,
	Type.Partial(CCommon.RSync),
	Type.Partial(CCommon.InstallDir),
]))(Base => class extends Base {
	@action('sync', t => t.isInstallDir || t.rsyncUpIncludes)
	protected async rsyncSync() {
		if (this.rsyncUpIncludes) {
			for (const include of this.rsyncUpIncludes) {
				await this.rsyncUp({ localSubPath: include });
			}
		} else {
			await this.rsyncUp();
		}
	}

	async rsyncUp(opts?: { localSubPath?: string; destSubPath?: string; excludes?: string[], protects?: string[], preserveSymlinks?: boolean }) {
		const destSubPath = opts?.destSubPath || '';
		const localSubPath = opts?.localSubPath || '';
		const excludes = [
			...(opts?.excludes || []),
			...(this.rsyncUpExcludes || []),
		];
		const protects = [
			...(opts?.protects || []),
			...(this.rsyncUpProtects || []),
		];
		const workDir = this.host.hostIsLocal
			? this.workDir
			: `${this.host.username}@${this.host.ip}:${this.workDir}`;
		const rsyncExcludes = [];
		const rsyncProtects = [];

		excludes.push(...GLOBAL_IGNORES);

		for (const exclude of excludes) {
			rsyncExcludes.push('--exclude');
			rsyncExcludes.push(exclude);
		}

		for (const protect of protects) {
			rsyncProtects.push('--filter');
			rsyncProtects.push(`protect ${protect}`);
		}

		const rsyncArgs = [
			'-avz',
			'--delete',
			...(!opts?.preserveSymlinks ? ['-L'] : []),
			...rsyncExcludes,
			...rsyncProtects,
		];

		if (!this.host.hostIsLocal) {
			rsyncArgs.push(...[
				'-e',
				'ssh',
			]);
		}

		rsyncArgs.push(
			`${this.localDir}/${localSubPath}`,
			`${workDir}/${destSubPath}`,
		);

		await this.localCmd('rsync', rsyncArgs, {
			noFail: true,
		});
	}

	async rsyncDown(opts?: { localSubPath?: string; remoteSubPath?: string; excludes?: string[] }) {
		const remoteSubPath = opts?.remoteSubPath || '';
		const localSubPath = opts?.localSubPath || '';
		const excludes = opts?.excludes || [];
		const rsyncExcludes = [];

		excludes.push(...GLOBAL_IGNORES);

		for (const exclude of excludes) {
			rsyncExcludes.push('--exclude');
			rsyncExcludes.push(exclude);
		}

		await this.localCmd('rsync', [
			'-avz',
			'--delete',
			'-L',
			...rsyncExcludes,
			'-e',
			'ssh',
			`${this.host.username}@${this.host.ip}:${this.workDir}/${remoteSubPath}`,
			`${this.localDir}/${localSubPath}`,
		]);
	}
});

export default rsync;

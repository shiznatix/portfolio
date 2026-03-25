import { Type } from '@sinclair/typebox';
import { CCommon } from '../configs';
import { action, hook } from '../annotations';
import { withMixin } from '../mixin-factory';
import flags from './flags';
import { CmdError } from '../../../errors';
import { secsToRelativeTime } from '../../../utils';

type InstallOpts = {
	forceUpdate?: boolean;
	reinstall?: boolean;
	ignoreDpkgError?: boolean;
};

export const APT_UPDATE_TS_FILE = '/var/lib/apt/manual-update-stamp';
export const APT_UPDATE_PAUSE_SEC = 10800; // 3 hours

const aptUpdatedHosts: string[] = [];

const apt = withMixin('apt', Type.Partial(CCommon.AptDeps), flags)
(Base => class extends Base {
	private async aptHasRecentUpdate(): Promise<boolean> {
		if (aptUpdatedHosts.find(h => h === this.host.name)) {
			return true;
		}

		const cmd = [
			`stat -c %Y ${APT_UPDATE_TS_FILE} >/dev/null 2>&1`,
			`DIFF=$(( $(date +%s) - $(stat -c %Y ${APT_UPDATE_TS_FILE}) ))`,
			`echo $DIFF`,
			`[ $DIFF -lt ${APT_UPDATE_PAUSE_SEC} ]`,
		].join(' && ');
		const { code, stdout } = await this.cmd(cmd, {
			noFail: true,
			silent: true,
		});
		const diffSec = parseInt(stdout.trim(), 10);
		const relativeTime = isNaN(diffSec) ? stdout.trim() : secsToRelativeTime(diffSec);
		this.log(`APT updated ${relativeTime} (code ${code})`);
		if (code === 0) {
			aptUpdatedHosts.push(this.host.name);
			return true;
		}
		return false;
	}

	@(action('deps', t => t.aptDependencies?.length).optional('apt').flag('force'))
	// TODO - we lost the `--skip apt` flag when moving this to a hook!
	@hook('install.begin', t => t.aptDependencies?.length)
	protected async aptDepsInstall() {
		if (this.initiatingAction === 'dev') {
			return;
		}

		await this.aptInstall(this.aptDependencies as string[], this.aptDepencenciesFlags);
	}

	async aptUpdate(force = false) {
		if (!force && !this.flags.force) {
			const hasRecentUpdate = await this.aptHasRecentUpdate();
			if (hasRecentUpdate) {
				return;
			}
		}

		await this.cmd(`sudo apt --allow-releaseinfo-change update && sudo touch ${APT_UPDATE_TS_FILE}`);
		aptUpdatedHosts.push(this.host.name);
	}

	async aptUpgrade() {
		if (this.flagsSkip('apt')) {
			return;
		}

		await this.aptUpdate();
		await this.cmd('sudo apt full-upgrade -y');
		await this.cmd('sudo apt autoremove -y');
		await this.cmd('which ts || sudo apt install moreutils -y');
	}

	async aptInstall(packages: string[], opts?: InstallOpts): Promise<void> {
		if (this.flagsSkip('apt')) {
			return;
		}

		await this.aptUpdate(!!opts?.forceUpdate);

		const flags = ['-y'];
		if (opts?.reinstall) {
			flags.push('--reinstall');
		}

		try {
			await this.cmd(`sudo apt install ${packages.join(' ')} ${flags.join(' ')}`);
		} catch (error) {
			const dpkgError = !opts?.ignoreDpkgError
				&& error instanceof CmdError
				&& `${error.stdout}${error.stderr}`.includes('sudo dpkg --configure -a')
			if (dpkgError) {
				await this.cmd('sudo dpkg --configure -a');
				return await this.aptInstall(packages, { ...opts, ignoreDpkgError: true });
			}
			throw error;
		}
	}

	async aptUninstall(packages: string[] | string) {
		if (this.flagsSkip('apt')) {
			return;
		}

		packages = Array.isArray(packages) ? packages : [packages];
		if (!packages.length) {
			return;
		}

		await this.cmd(`sudo apt remove --purge ${packages.join(' ')} -y`);
	}
});

export default apt;

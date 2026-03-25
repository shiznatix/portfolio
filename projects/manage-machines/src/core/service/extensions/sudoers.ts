import { Type } from '@sinclair/typebox';
import { CCommon, CServiceCommon } from '../configs';
import { action, hook } from '../annotations';
import { arrayUnique } from '../../../utils';
import { withMixin } from '../mixin-factory';
import files from '../common/files';

const sudoers = withMixin(
	'sudoers',
	Type.Intersect([
		CCommon.Sudoers,
		Type.Partial(CServiceCommon.UnitFile),
		Type.Partial(CCommon.WorkDir),
	]),
	files,
)(Base => class extends Base {
	private readonly filePath = `/etc/sudoers.d/${this.host.username}_manage-machines`;
	private readonly sectionName = this.unitFileName || this.name;
	private readonly delimiters = {
		startStr: `# start ${this.sectionName}`,
		endStr: `# end ${this.sectionName}`,
	};

	private sudoersMakeCommands(cmds: string[]) {
		return arrayUnique(cmds
			.map(c => c.replaceAll(':', '\\:'))
			.map(c => `${this.host.username} ALL=(ALL) NOPASSWD: ${c}`)
		);
	}

	private async sudoersEnsureExists() {
		const exists = await this.fileExists(this.filePath);
		if (exists) {
			return;
		}

		const cmds = [
			`/usr/bin/tee * ${this.filePath}`,
			`/usr/bin/cat ${this.filePath}`,
			`/usr/bin/rm -f ${this.filePath}`,
			`/usr/bin/sed * ${this.filePath}`,
		];
		await this.configAppend(this.filePath, this.sudoersMakeCommands(cmds));
	}

	@action('sudo')
	@hook('install.begin')
	async sudoersInstall() {
		const cmds = this.sudoersMakeCommands(this.sudoers);
		await this.sudoersEnsureExists();
		await this.configReplace(this.filePath, cmds, this.delimiters);
	}

	@hook('uninstall.end')
	async sudoersUninstall() {
		await this.configRemove(this.filePath, this.delimiters);
	}
});

export default sudoers;

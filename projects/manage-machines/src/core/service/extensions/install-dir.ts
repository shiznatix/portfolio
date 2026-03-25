import { CCommon } from '../configs';
import { hook } from '../annotations';
import { withMixin } from '../mixin-factory';
import prompt from '../common/prompt';
import files from '../common/files';

const installDir = withMixin('installDir', CCommon.InstallDir, prompt, files)
(Base => class extends Base {
	@hook('install.begin')
	protected async installDirCreate() {
		await this.mkdir(this.installDir, { owner: this.host.username });

		if (this.installSubDirs?.length) {
			for (const dir of this.installSubDirs) {
				await this.mkdir(dir, { owner: this.host.username });
			}
		}
	}

	@hook('uninstall.end', ({ installDirDelete: v }) => v)
	protected async installDirRemove() {
		if (this.installDirDelete === 'prompt') {
			const delFolder = await this.promptWantingNo('Delete service files/folders as well?');
			if (!delFolder) {
				return;
			}
		}

		await this.cmd(`sudo rm -rf ${this.installDir}`, {
			noFail: true,
		});
	}
});

export default installDir;

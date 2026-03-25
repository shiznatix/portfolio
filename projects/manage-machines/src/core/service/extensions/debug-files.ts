import { Type } from '@sinclair/typebox';
import { CCommon } from '../configs';
import { action } from '../annotations';
import { withMixin } from '../mixin-factory';
import flags from '../common/flags';

const debugFiles = withMixin(
	'debugFiles',
	Type.Intersect([
		CCommon.DebugFiles,
		Type.Partial(CCommon.WorkDir),
	]),
	flags,
)(Base => class extends Base {
	@(action('configs').optional('files'))
	async debugFilesPrint() {
		for (const file of this.debugFiles) {
			const path  = typeof file === 'string' ? file : file.path;
			const sudo = typeof file === 'string' ? false : file.sudo;
			const awkCmd = `awk 'FNR==1{n=split(FILENAME,a,"/"); border=""; for(i=1;i<=length(a[n])+4;i++) border=border"+"; print "\\n" border "\\n| " a[n] " |\\n" border}1'`;
			const cmd = sudo ? `sudo ${awkCmd}` : awkCmd;
			const fullPath = path.startsWith('/') || path.startsWith('~') || !this.workDir
				? path
				: `${this.workDir}/${path}`;

			this.log(`--- Conf file: ${fullPath} ---`);
			const { stdout } = await this.cmd(`${cmd} ${fullPath}`, {
				noFail: true,
				noTrim: true,
				silent: true,
			});
			this.log(stdout);
		}
	}
});

export default debugFiles;

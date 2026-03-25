import { Type } from '@sinclair/typebox';
import { CCommon } from '../configs';
import { action } from '../annotations';
import { withMixin } from '../mixin-factory';
import flags from './flags';

const snap = withMixin(
	'snap',
	Type.Partial(CCommon.SnapDeps),
	flags,
)(Base => class extends Base {
	@(action(['install', 'deps'], t => t.snapDependencies?.length).optional('snap'))
	protected async snapDepsInstall() {
		await this.snapInstall(this.snapDependencies as string[]);
	}

	async snapInstall(packages: string[]) {
		for (const pkg of packages) {
			const tail = this.snapDependenciesFlags?.classic ? `--classic ${pkg}` : pkg;
			await this.cmd(`sudo snap install ${tail}`);
		}
	}
});

export default snap;

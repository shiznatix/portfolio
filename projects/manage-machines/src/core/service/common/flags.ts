import chalk from 'chalk';
import { action } from '../annotations';
import { withMixin } from '../mixin-factory';
import { prettyJson } from '../../../utils';

const flags = withMixin('flags')
(Base => class extends Base {
	private readonly hasFlagsInclude = this.flags.include.length > 0;
	private readonly hasFlagsSkip = this.flags.skip.length > 0;

	flagsSkip(val: string) {
		if (this.hasFlagsInclude) {
			return !this.flags.include.includes(val);
		}
		if (this.hasFlagsSkip) {
			return !!this.flags.skip.includes(val);
		}
		return false;
	}

	flagsInclude(val: string, defaultValue = true) {
		if (this.hasFlagsInclude) {
			return !!this.flags.include.includes(val);
		}
		if (this.hasFlagsSkip) {
			return !this.flags.skip.includes(val);
		}
		return defaultValue;
	}

	flagsIncludeExplicit(val: string | string[]) {
		const vals = Array.isArray(val) ? val : [val];
		return !!vals.find(v => this.flags.include.includes(v));
	}

	@(action('debug').required('flags'))
	flagsDebugFlags() {
		this.log(chalk.bold(`--- Flags ---`));
		this.log(prettyJson(this.flags));
		this.log(chalk.bold(`--- /Flags ---`));
	}
});

export default flags;

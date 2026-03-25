import { ApplyMixinsFromArray } from './mixin-types';
import debugFiles from './extensions/debug-files';
import dev from './extensions/dev';
import docker from './extensions/docker';
import files from './common/files';
import sysd from './extensions/sysd';
import apt from './common/apt';
import flags from './common/flags';
import python from './extensions/python';
import rsync from './extensions/rsync';
import snap from './common/snap';
import sudoers from './extensions/sudoers';
import configJson from './extensions/config-json';
import configEnv from './extensions/config-env';
import prompt from './common/prompt';
import pi from './extensions/pi';
import host from './common/host';
import unitFile from './extensions/unit-file';
import installDir from './extensions/install-dir';
import npm from './extensions/npm';
import runnerBase from './runners/base';
import runnerDesktop from './runners/desktop';
import runnerDocker from './runners/docker';
import runnerStack from './runners/stack';
import runnerSysd from './runners/sysd';

export type InferMixins<C> = ApplyMixinsFromArray<C, typeof mixins>;
export type MixinName = typeof mixins[number]['Name'];

// NB! Order matters!
const mixins = [
	flags,
	prompt,
	files,
	host,
	pi,
	installDir,
	configEnv,
	configJson,
	rsync,
	apt,
	snap,
	sudoers,
	debugFiles,
	python,
	sysd,
	unitFile,
	docker,
	dev,
	npm,
] as const;
export const applyMixins = (Base: any) => mixins
	.reduce((acc, mixin) => {
		return mixin(acc);
	}, Base);

// NB! Order matters!
const runners = [
	runnerDesktop,
	runnerDocker,
	runnerSysd,
	runnerStack,
	runnerBase,
];
export const applyRunners = (Base: any) => runners
	.reduce((acc, runner) => {
		return runner(acc);
	}, Base);

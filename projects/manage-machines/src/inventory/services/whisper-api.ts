import { action, hook } from '../../core/service/annotations';
import { sysdService } from '../../core/service/service-factory';

export type WhisperApiProps = {
	model?: 'tiny.en' | 'base.en' | 'small.en' | 'medium.en' | 'large' | 'turbo';
	ports?: {
		http?: number;
	};
};

const REPO_URL = 'https://github.com/ggerganov/whisper.cpp.git';

export default sysdService<WhisperApiProps>()({
	name: 'whisper-api',
	isInstallDir: true,
	configJson: true,
	unitFileTemplate: 'service',
	aptDependencies: [
		'build-essential',
		'git',
		'cmake',
		'ffmpeg',
	],
	rsyncUpExcludes: ['whisper.cpp'],
	props: {
		model: 'small.en',
	},
	ports: {
		http: 9060,
	},
})(Base => class extends Base {
	unitExecStart = [
		`${this.workDir}/whisper.cpp/build/bin/whisper-server`,
		'	--language en',
		`	--model ${this.workDir}/whisper.cpp/models/ggml-${this.props.model!}.bin`,
		'	--host 0.0.0.0',
		'	--port {{HTTP_PORT}}',
		'	--no-timestamps',
		'	--suppress-nst',
		'	--word-thold -1',
	].join(' \\\n');
	whisperDir = `${this.workDir}/whisper.cpp`;

	@(action('install').filter('build'))
	async install() {
		const { code } = await this.cmd(`test -d ${this.whisperDir}`, {
			noFail: true,
			silent: true,
		});
		if (code !== 0 || this.flagsIncludeExplicit('build')) {
			await this.cmd(`rm -rf ${this.whisperDir}`);
			await this.cmd(`git clone --depth 1 --branch master ${REPO_URL} ${this.whisperDir}`);
			const build = this.host.groups?.includes('raspberry-pi')
				? [
					'CFLAGS="-O3 -mcpu=cortex-a76 -mtune=cortex-a76 -ffast-math -fno-finite-math-only"',
					'CXXFLAGS="-O3 -mcpu=cortex-a76 -mtune=cortex-a76 -ffast-math -fno-finite-math-only"',
					'make -j$(nproc)',
				  ].join(' ')
				: [
					'export PATH=/usr/local/cuda-13.1/bin:\$PATH &&',
					'export LD_LIBRARY_PATH=/usr/local/cuda-13.1/lib64:\$LD_LIBRARY_PATH &&',
					'cmake -B build -DGGML_CUDA=1 -DGGML_CUDA_F16=1 -DCMAKE_BUILD_TYPE=Release &&',
					'cmake --build build -j$(nproc)',
				  ].join(' ');
			await this.cmd(`cd ${this.whisperDir} && ${build}`);
		}
	}

	@action('deps')
	@hook('sync.end')
	async afterSync() {
		await this.cmd(`${this.whisperDir}/models/download-ggml-model.sh ${this.props.model}`);
	}
});

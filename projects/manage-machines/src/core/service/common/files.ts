import { Type } from '@sinclair/typebox';
import fs from 'fs/promises';
import { withMixin } from '../mixin-factory';
import { CCommon } from '../configs';
import { CmdOpts } from '../../host/types';

const DEFAULT_MMCONFIGSTART = '# manage-machines';
const DEFAULT_MMCONFIGEND = '# end manage-machines';

type FileOpts = {
	owner?: string;
	permissions?: string | number;
};
type ConfigDelimiters = {
	startStr?: string;
	endStr?: string;
};

const files = withMixin('files', Type.Intersect([
	Type.Partial(CCommon.WorkDir),
	Type.Partial(CCommon.LocalDir),
]))(Base => class extends Base {
	private async canWrite(path: string) {
		try {
			const { code } = await this.cmd(`test -w "${path}"`, {
				noFail: true,
				silent: true,
			});
			return code === 0;
		} catch {
			return false;
		}
	}

	private async sudoPrefix(path: string) {
		const canWrite = await this.canWrite(path);
		return canWrite ? '' : 'sudo ';
	}

	private relPath(path: string) {
		path = path.trim();
		return path.startsWith('/')
			? path
			: this.workDir
				? `${this.workDir}/${path}`
				: `/home/${this.host.username}/${path}`;
	}

	private relLocalPath(path: string) {
		path = path.trim();
		return path.startsWith('/')
			? path
			: this.localDir
				? `${this.localDir}/${path}`
				: `/home/$USER/${path}`;
	}

	async write(path: string, contents: string, opts?: FileOpts) {
		const parts = path.trim().split('/');
		const name = parts.pop() || path;
		const relPath = parts.join('/');
		const relPathAsSub = relPath && !relPath.startsWith('/') ? `/${relPath}` : relPath;
		const destSubPath = relPath.startsWith('/')
			? relPath
			: this.workDir
				? `${this.workDir}${relPathAsSub}`
				: `/home/${this.host.username}${relPathAsSub}`;
		const localPath = `${process.cwd()}/temp.${this.name}.${this.host.ip}.${name}`;
		const finalDestPath = `${destSubPath}/${name}`;
		const initialDestPath = `/tmp/${this.name}_${name}`;

		if (!contents.endsWith('\n')) {
			contents = `${contents}\n`;
		}

		await fs.writeFile(localPath, contents);
		if (this.host.hostIsLocal) {
			await this.cmd(`mv ${localPath} ${initialDestPath}`);
		} else {
			await this.scp('up', { localPath, remotePath: initialDestPath });
			await fs.rm(localPath);
		}

		const sudoPrefix = await this.sudoPrefix(destSubPath);
		await this.cmd(`${sudoPrefix}mv ${initialDestPath} ${finalDestPath}`);

		if (opts?.owner) {
			await this.cmd(`${sudoPrefix}chown ${opts.owner}:${opts.owner} ${finalDestPath}`);
		}
		if (opts?.permissions) {
			await this.cmd(`${sudoPrefix}chmod ${opts.permissions} ${finalDestPath}`);
		}
	}

	async read(path: string, opts?: CmdOpts) {
		path = this.relPath(path);
		const { stdout } = await this.cmd(`cat "${path}"`, {
			...opts,
			silent: true,
		});
		return stdout;
	}

	async scp(direction: 'up' | 'down', opts: { localPath: string; remotePath: string; }) {
		const remotePath = `${this.host.username}@${this.host.ip}:${this.relPath(opts.remotePath)}`;
		const localPath = this.relLocalPath(opts.localPath);
		if (direction === 'up') {
			await this.localCmd('scp', [localPath, remotePath]);
		} else {
			await this.localCmd('scp', [remotePath, localPath]);
		}
	}

	async mkdir(path: string, opts?: FileOpts) {
		path = this.relPath(path);
		const sudoPrefix = await this.sudoPrefix(path);
		await this.cmd(`${sudoPrefix}mkdir -p ${path}`);

		if (opts?.owner) {
			await this.cmd(`${sudoPrefix}chown ${opts.owner}:${opts.owner} ${path}`);
		}
		if (opts?.permissions) {
			await this.cmd(`${sudoPrefix}chmod ${opts.permissions} ${path}`);
		}
	}

	async fileExists(path: string, opts?: CmdOpts) {
		path = this.relPath(path);
		const { code } = await this.cmd(`test -f "${path}"`, {
			noFail: true,
			silent: true,
			...opts,
		});
		return code === 0;
	}

	async dirNotEmpty(path: string, opts?: CmdOpts) {
		path = this.relPath(path);
		const { code } = await this.cmd(`test -d "${path}" && [ -n "$(ls -A ${path})" ]`, {
			noFail: true,
			silent: true,
			...opts,
		});
		return code === 0;
	}

	async configCommentOut(path: string, keys: string | string[]) {
		path = this.relPath(path);
		const sudoPrefix = await this.sudoPrefix(path);
		const keysArr = Array.isArray(keys) ? keys : [keys];
		const replacements = keysArr.map(key => `-e 's/^${key}/# ${key}/'`).join(' ');
		await this.cmd(`${sudoPrefix}sed -i ${replacements} ${path}`);
	}

	async configRemove(path: string, opts?: ConfigDelimiters) {
		path = this.relPath(path);
		const sudoPrefix = await this.sudoPrefix(path);
		const startStr = opts?.startStr || DEFAULT_MMCONFIGSTART;
		const endStr = opts?.endStr || DEFAULT_MMCONFIGEND;
		await this.cmd(`${sudoPrefix}sed -i "/${startStr}/,/${endStr}/d" ${path}`, {
			noFail: true,
		});
	}

	async configAppend(path: string, lines: string | string[], opts?: ConfigDelimiters) {
		path = this.relPath(path);
		const sudoPrefix = await this.sudoPrefix(path);
		const newLines = [
			(opts?.startStr || DEFAULT_MMCONFIGSTART),
			...(Array.isArray(lines) ? lines : [lines]),
			(opts?.endStr || DEFAULT_MMCONFIGEND),
		].join('\n');

		// Ensure at least one blank line before appended content
		await this.cmd(`tail -1 ${path} | grep -q . && printf '\\n' | ${sudoPrefix}tee -a ${path} >/dev/null || true`);
		// Use with here-document to avoid variable expansion issues
		await this.cmd(`${sudoPrefix}tee -a ${path} >/dev/null <<'EOF'\n${newLines}\nEOF`);
	}

	async configReplace(path: string, lines: string | string[] | { commentOut: string[]; config: string[] }, opts?: ConfigDelimiters) {
		const configLines = typeof lines === 'object' && !Array.isArray(lines)
			? lines.config
			: Array.isArray(lines)
				? lines
				: [lines];
		const commentOut = typeof lines === 'object' && !Array.isArray(lines)
			? lines.commentOut.length > 0
				? lines.commentOut
				: null
			: null;

		await this.configRemove(path, opts);
		if (commentOut) {
			await this.configCommentOut(path, commentOut);
		}
		await this.configAppend(path, configLines, opts);
	}

	async configPrint(path: string, opts?: ConfigDelimiters) {
		path = this.relPath(path);
		const startStr = opts?.startStr || DEFAULT_MMCONFIGSTART;
		const endStr = opts?.endStr || DEFAULT_MMCONFIGEND;
		await this.cmd(`sed -n '/${startStr}/,/${endStr}/p' ${path}`, {
			noFail: true,
		});
	}
});

export default files;

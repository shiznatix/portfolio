import stripAnsi from 'strip-ansi';

export class CmdError extends Error {
	public stdout: string;
	public stderr: string;
	public code: number | string;

	constructor(msg: string, stdout: string, stderr: string, code: number | string) {
		super(msg);
		this.stdout = stripAnsi(stdout);
		this.stderr = stripAnsi(stderr);
		this.code = code;
	}

	toString() {
		return `CmdError - code:${this.code} stdout:${this.stdout} stderr:${this.stderr}`;
	}
}

export class SkippableError extends Error {
	public silent: boolean;

	constructor(msg: string, silent = false) {
		super(msg);
		this.silent = silent;
	}
}

export class HostOfflineError extends Error {
}

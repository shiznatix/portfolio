import { HostGroup } from '../../inventory/hosts';
import { LoggerInstance } from '../../logger';

export type CmdOpts = {
	cwd?: string;
	exitOnStr?: string | string[];
	stdCallback?: (str: string) => void;
	inputOnPrompt?: {
		lineEnd: string;
		input: string;
	};
	noFail?: boolean;
	silent?: boolean;
	timeoutSec?: number;
	noTrim?: boolean;
	destHost?: HostConfig;
	logger?: LoggerInstance;
	dryRun?: boolean;
	caller?: string | null;
	local?: boolean;
};

export type CmdOutput = {
	stdout: string;
	stderr: string;
	code: number | string;
};

export type HostDnsRecord = {
	ip: string;
	name: string;
};

export type HostConfig = {
	readonly ip: string;
	readonly extraDns?: HostDnsRecord[];
	readonly username: string;
	readonly password?: string;
	readonly groups?: readonly HostGroup[];
	readonly drives?: {
		readonly [key: string]: string;
	};
	readonly services: Record<string, any>;
	readonly stubProps?: Record<string, any>;
};

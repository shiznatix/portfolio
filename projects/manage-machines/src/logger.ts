import chalk, { ChalkInstance } from 'chalk';
import { CCommon } from './core/service/configs';

export type LoggerInstance = {
	(...args: any[]): void;
	log: (...args: any[]) => void;
	warn: (...args: any[]) => void;
	error: (...args: any[]) => void;
	verbose: (...args: any[]) => void;
	extend: (childConf?: CCommon.Log) => LoggerInstance;
	inc: () => LoggerInstance;
	dec: () => LoggerInstance;
};

class Logger {
	static readonly INCREMENT = 1;

	private indent: number;
	private name: string;
	private style1: ChalkInstance;
	private style2: ChalkInstance;
	private styleBg: ChalkInstance;
	private noSymbol: boolean;
	private verboseEnabled: boolean;

	constructor(conf?: CCommon.Log) {
		this.indent = conf?.indent ?? 0;
		this.name = conf?.name ?? '';
		this.style1 = conf?.style1 ?? chalk.gray;
		this.style2 = conf?.style2 ?? chalk.reset;
		this.styleBg = conf?.styleBg ?? chalk.reset;
		this.noSymbol = conf?.noSymbol ?? false;
		this.verboseEnabled = conf?.verbose ?? false;

		return this.callable();
	}

	private callable() {
		const call = (...args: any[]) => this.log(...args);
		call.log = this.log.bind(this);
		call.warn = this.warn.bind(this);
		call.error = this.error.bind(this);
		call.verbose = this.verbose.bind(this);
		call.extend = this.extend.bind(this);
		call.inc = this.inc.bind(this);
		call.dec = this.dec.bind(this);

		return call as any;
	}

	private pad(s: string, ...args: any[]) {
		const indent = ' '.repeat(this.indent);
		const symbol = this.noSymbol ? '' : s;
		const name = this.name ? this.style1(`${this.name} |`) : '';
		const paddedName = name ? `${name}` : '';
		const msg = this.style2(...args);
		const prefix = this.styleBg(indent);

		return `${prefix}${symbol}${paddedName}${msg}`;
	}

	log(...args: any[]) {
		console.log(this.pad('🔹', ...args));
	}
	warn(...args: any[]) {
		console.log(this.pad('⚠️ ', ...args));
	}
	error(...args: any[]) {
		console.error(this.pad('💥 ', ...args));
	}
	verbose(...args: any[]) {
		if (this.verboseEnabled) {
			console.log(this.pad('✳️ ', ...args));
		}
	}

	inc() {
		this.indent += Logger.INCREMENT;
		return this.callable();
	}
	dec() {
		this.indent = Math.max(0, this.indent - Logger.INCREMENT);
		return this.callable();
	}

	extend(childConf?: CCommon.Log) {
		return new Logger({
			indent: this.indent,
			name: this.name,
			style1: this.style1,
			style2: this.style2,
			styleBg: this.styleBg,
			verbose: this.verboseEnabled,
			noSymbol: this.noSymbol,
			...childConf,
		});
	}
}

const logger = (conf?: CCommon.Log) => new Logger(conf) as unknown as LoggerInstance;

export default logger;

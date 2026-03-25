import chalk from 'chalk';
import readline from 'readline';
import { withMixin } from '../mixin-factory';

const askQuestion = (msg: string, defaultVal: string): Promise<string> => {
	return new Promise((resolve, reject) => {
		let savedRawMode: boolean | undefined;
        if (process.stdin.isTTY && process.stdin.setRawMode) {
            savedRawMode = (process.stdin as any).isRaw;
            process.stdin.setRawMode(false);
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
			terminal: false, // Disable readline's terminal manipulation
        });

        let resolved = false;

        const cleanup = () => {
            if (resolved) {
				return;
			}

            resolved = true;
            rl.close();

			// Restore terminal state
            if (process.stdin.isTTY && process.stdin.setRawMode && savedRawMode !== undefined) {
                process.stdin.setRawMode(savedRawMode);
            }

            // Ensure cursor is visible and terminal is in normal mode
            // process.stdout.write('\x1B[?25h'); // Show cursor
        };

        rl.on('error', (err) => {
            cleanup();
            reject(err);
        });

        rl.on('SIGINT', () => {
            cleanup();
            process.exit(130);
        });

        rl.question(`${msg} (${defaultVal}): `, (answer) => {
            cleanup();

            const cleanAnswer = answer.trim().toLowerCase();
            if (['y', 'n'].includes(cleanAnswer)) {
                resolve(cleanAnswer);
            } else {
                resolve(defaultVal.toLowerCase());
            }
        });
    });
};

const prompt = withMixin('prompt')
(Base => class extends Base {
	async prompt(msg: string, defaultVal: string): Promise<string> {
		if (this.flags.noprompt) {
			return defaultVal;
		}

		return await askQuestion(msg, defaultVal);
	}

	async promptWantingYes(msg: string) {
		msg = chalk
			.hex('#ffffff').bold
			.bgHex('#1dbe33')
			(` ${msg} `);
		const res = await this.prompt(`✅ ${msg}`, 'Y');
		return res.toLowerCase() !== 'n';
	}

	async promptWantingNo(msg: string) {
		msg = chalk
			.hex('#ffffff').bold
			.bgHex('#be1d1d')
			(` ${msg} `);
		const res = await this.prompt(`⛔ ${msg}`, 'N');
		return res.toLowerCase() === 'y';
	}
});

export default prompt;

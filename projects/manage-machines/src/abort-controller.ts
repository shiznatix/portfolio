const abortController = new AbortController();
export default abortController;
export const abortSignal = abortController.signal;

let signalsReceived = 0;
export const shutdown = async () => {
	signalsReceived++;
	abortController.abort();

	if (signalsReceived > 1) {
		await new Promise(a => setTimeout(a, 500));
		process.exit(1);
	}
};

process.on('SIGINT', shutdown);  // CTRL+C
process.on('SIGQUIT', shutdown); // Keyboard quit
process.on('SIGTERM', shutdown); // `kill` command

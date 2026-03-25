import { RhAssistantProps } from '../../../services/rh-assistant';
import { hub } from '../../hub/local';
import { redhouse } from '../local';

export default {
	keyphrase: 'red house',
	ollamaUrl: redhouse.url('ollama'),
	whisperApiUrl: redhouse.url('whisperApi'),
	piperApiUrl: redhouse.url('piperVoice', { port: 'server' }),
	tools: {
		prometheus: hub.url('prometheus'),
	},
} as const satisfies RhAssistantProps;

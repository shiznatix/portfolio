import { TSchema } from '@sinclair/typebox';
import { pythonService } from '../../core/service/service-factory';

export type RhRagProps = {
	collections: {
		name: string;
		hnswSpace?: 'cosine' | 'l2' | 'ip';
		documentMetadataSchema?: TSchema;
	}[];
	ports?: {
		http?: number;
	};
};

export default pythonService<RhRagProps>()({
	name: 'rh-rag',
	configJson: true,
	unitFileTemplate: 'service',
	installSubDirs: [
		'chroma-db',
	],
	rsyncUpExcludes: [
		'chroma-db/',
	],
	ports: {
		http: 5300,
	},
})(Base => class extends Base {
});

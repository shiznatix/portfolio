import { Type, TSchema } from '@sinclair/typebox';

export default function sensorSchema(sensorName: string, valueSchema?: TSchema): TSchema {
	return Type.Object({
		name: Type.Literal(sensorName),
		value: valueSchema || Type.Optional(Type.Any()),
	});
}

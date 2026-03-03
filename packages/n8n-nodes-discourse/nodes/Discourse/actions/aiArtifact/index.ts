import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { description as createDescription, execute as createExecute } from './operations/create.operation';
import { description as deleteDescription, execute as deleteExecute } from './operations/delete.operation';
import { description as getDescription, execute as getExecute } from './operations/get.operation';
import { description as getManyDescription, execute as getManyExecute } from './operations/getMany.operation';
import { description as updateDescription, execute as updateExecute } from './operations/update.operation';

const showOnlyForAiArtifacts = {
	resource: ['aiArtifact'],
};

export type AiArtifactOperation = 'create' | 'delete' | 'get' | 'getMany' | 'update';

export type AiArtifactOperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

export const aiArtifactOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForAiArtifacts,
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an AI artifact',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an AI artifact',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an AI artifact',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many AI artifacts',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an AI artifact',
			},
		],
		default: 'getMany',
	},
	...createDescription,
	...deleteDescription,
	...getDescription,
	...getManyDescription,
	...updateDescription,
];

export const aiArtifactOperationHandlers: Record<AiArtifactOperation, AiArtifactOperationHandler> = {
	create: createExecute,
	delete: deleteExecute,
	get: getExecute,
	getMany: getManyExecute,
	update: updateExecute,
};

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { description as createDescription, execute as createExecute } from './operations/create.operation';
import { description as deleteDescription, execute as deleteExecute } from './operations/delete.operation';
import { description as getDescription, execute as getExecute } from './operations/get.operation';
import { description as getManyDescription, execute as getManyExecute } from './operations/getMany.operation';
import { description as setDescription, execute as setExecute } from './operations/set.operation';
import { description as updateDescription, execute as updateExecute } from './operations/update.operation';

const showOnlyForAiArtifactStorage = {
	resource: ['aiArtifactStorage'],
};

export type AiArtifactStorageOperation = 'create' | 'delete' | 'get' | 'getMany' | 'set' | 'update';

export type AiArtifactStorageOperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

export const aiArtifactStorageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForAiArtifactStorage,
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an AI artifact storage entry',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an AI artifact storage key',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an AI artifact storage entry',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many AI artifact storage entries',
			},
			{
				name: 'Set',
				value: 'set',
				action: 'Set an AI artifact storage key',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an AI artifact storage entry',
			},
		],
		default: 'getMany',
	},
	...createDescription,
	...deleteDescription,
	...getDescription,
	...getManyDescription,
	...setDescription,
	...updateDescription,
];

export const aiArtifactStorageOperationHandlers: Record<
	AiArtifactStorageOperation,
	AiArtifactStorageOperationHandler
> = {
	create: createExecute,
	delete: deleteExecute,
	get: getExecute,
	getMany: getManyExecute,
	set: setExecute,
	update: updateExecute,
};

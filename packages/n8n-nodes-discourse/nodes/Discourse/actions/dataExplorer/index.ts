import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { description as createDescription, execute as createExecute } from './operations/create.operation';
import { description as deleteDescription, execute as deleteExecute } from './operations/delete.operation';
import { description as getDescription, execute as getExecute } from './operations/get.operation';
import { description as getManyDescription, execute as getManyExecute } from './operations/getMany.operation';
import { description as runDescription, execute as runExecute } from './operations/run.operation';
import { description as updateDescription, execute as updateExecute } from './operations/update.operation';

const showOnlyForDataExplorer = {
	resource: ['dataExplorer'],
};

export type DataExplorerOperation = 'create' | 'delete' | 'get' | 'getMany' | 'run' | 'update';

export type DataExplorerOperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

export const dataExplorerOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForDataExplorer,
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a query',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a query',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a query',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many queries',
			},
			{
				name: 'Run',
				value: 'run',
				action: 'Run a query',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a query',
			},
		],
		default: 'getMany',
	},
	...createDescription,
	...deleteDescription,
	...getDescription,
	...getManyDescription,
	...runDescription,
	...updateDescription,
];

export const dataExplorerOperationHandlers: Record<DataExplorerOperation, DataExplorerOperationHandler> = {
	create: createExecute,
	delete: deleteExecute,
	get: getExecute,
	getMany: getManyExecute,
	run: runExecute,
	update: updateExecute,
};

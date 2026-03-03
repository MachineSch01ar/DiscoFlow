import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { description as createDescription, execute as createExecute } from './operations/create.operation';
import { description as deleteDescription, execute as deleteExecute } from './operations/delete.operation';
import { description as getDescription, execute as getExecute } from './operations/get.operation';
import { description as getManyDescription, execute as getManyExecute } from './operations/getMany.operation';
import { description as updateDescription, execute as updateExecute } from './operations/update.operation';

const showOnlyForCategories = {
	resource: ['category'],
};

export type CategoryOperation = 'create' | 'delete' | 'get' | 'getMany' | 'update';

export type CategoryOperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

export const categoryOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForCategories,
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a category',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a category',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a category',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many categories',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a category',
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

export const categoryOperationHandlers: Record<CategoryOperation, CategoryOperationHandler> = {
	create: createExecute,
	delete: deleteExecute,
	get: getExecute,
	getMany: getManyExecute,
	update: updateExecute,
};

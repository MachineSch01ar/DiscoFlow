import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { description as deleteDescription, execute as deleteExecute } from './operations/delete.operation';
import { description as getDescription, execute as getExecute } from './operations/get.operation';
import {
	description as getManyLatestDescription,
	execute as getManyLatestExecute,
} from './operations/getManyLatest.operation';
import {
	description as getManyTopDescription,
	execute as getManyTopExecute,
} from './operations/getManyTop.operation';
import { description as searchDescription, execute as searchExecute } from './operations/search.operation';
import { description as createDescription, execute as createExecute } from './operations/create.operation';
import { description as updateDescription, execute as updateExecute } from './operations/update.operation';
import {
	description as setStatusDescription,
	execute as setStatusExecute,
} from './operations/setStatus.operation';

const showOnlyForTopics = {
	resource: ['topic'],
};

export type TopicOperation =
	| 'delete'
	| 'get'
	| 'getManyLatest'
	| 'getManyTop'
	| 'search'
	| 'create'
	| 'update'
	| 'setStatus';

export type TopicOperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

export const topicOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForTopics,
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a topic',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a topic',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a topic',
			},
			{
				name: 'Get Many (Latest)',
				value: 'getManyLatest',
				action: 'Get latest topics',
			},
			{
				name: 'Get Many (Top)',
				value: 'getManyTop',
				action: 'Get top topics',
			},
			{
				name: 'Search',
				value: 'search',
				action: 'Search topics',
			},
			{
				name: 'Set Status',
				value: 'setStatus',
				action: 'Set topic status',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a topic',
			},
		],
		default: 'getManyLatest',
	},
	...deleteDescription,
	...getDescription,
	...getManyLatestDescription,
	...getManyTopDescription,
	...searchDescription,
	...createDescription,
	...updateDescription,
	...setStatusDescription,
];

export const topicOperationHandlers: Record<TopicOperation, TopicOperationHandler> = {
	delete: deleteExecute,
	get: getExecute,
	getManyLatest: getManyLatestExecute,
	getManyTop: getManyTopExecute,
	search: searchExecute,
	create: createExecute,
	update: updateExecute,
	setStatus: setStatusExecute,
};

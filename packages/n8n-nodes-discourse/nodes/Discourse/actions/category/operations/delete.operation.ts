import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getCategoryId, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';

const displayOptions = {
	show: {
		resource: ['category'],
		operation: ['delete'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Category ID or URL',
		name: 'categoryId',
		type: 'resourceLocator',
		default: {
			mode: 'id',
			value: '',
		},
		required: true,
		displayOptions,
		modes: [
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: '42',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				placeholder: 'https://forum.example.com/c/category-name/42',
				extractValue: {
					type: 'regex',
					regex: '/c/(?:[^/]+/)*(\\d+)',
				},
			},
		],
	},
	{
		displayName: 'Delete Topics Too',
		name: 'deleteTopics',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether to delete all topics in the category as part of deletion',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const categoryIdInput = this.getNodeParameter('categoryId', itemIndex);
	const deleteTopics = this.getNodeParameter('deleteTopics', itemIndex, false) as boolean;

	let categoryId: number;
	try {
		categoryId = getCategoryId(categoryIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	await discourseApiRequest.call(this, itemIndex, 'DELETE', `/categories/${categoryId}.json`, {
		delete_topics: deleteTopics ? 'true' : undefined,
	});

	return toExecutionData(itemIndex, { deleted: true });
}

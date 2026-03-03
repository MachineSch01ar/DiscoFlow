import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getCategoryId, simplifyCategory, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { extractCategory } from '../helpers';

const displayOptions = {
	show: {
		resource: ['category'],
		operation: ['get'],
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
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		displayOptions,
		description: 'Whether to return a simplified version of the response instead of the raw data',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const categoryIdInput = this.getNodeParameter('categoryId', itemIndex);
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	let categoryId: number;
	try {
		categoryId = getCategoryId(categoryIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const response = await discourseApiRequest.call(this, itemIndex, 'GET', `/c/${categoryId}/show.json`);

	if (simplify) {
		const category = extractCategory(response);
		if (!category) {
			throw new NodeOperationError(this.getNode(), 'Category data was not found in the API response.', {
				itemIndex,
			});
		}

		return toExecutionData(itemIndex, simplifyCategory(category));
	}

	return toExecutionData(itemIndex, response);
}

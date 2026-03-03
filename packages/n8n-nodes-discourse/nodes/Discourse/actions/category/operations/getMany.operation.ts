import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { simplifyCategory, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { getCategoriesFromResponse } from '../helpers';

const displayOptions = {
	show: {
		resource: ['category'],
		operation: ['getMany'],
	},
};

export const description: INodeProperties[] = [
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
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const response = await discourseApiRequest.call(this, itemIndex, 'GET', '/categories.json');

	if (simplify) {
		const categories = getCategoriesFromResponse(response);
		return toExecutionData(itemIndex, categories.map((category) => simplifyCategory(category)));
	}

	return toExecutionData(itemIndex, response);
}

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { simplifyPost, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';

const displayOptions = {
	show: {
		resource: ['topic'],
		operation: ['search'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Search query value passed to Discourse as q',
	},
	{
		displayName: 'Page',
		name: 'page',
		type: 'number',
		default: 1,
		typeOptions: {
			minValue: 1,
		},
		displayOptions,
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
	const query = this.getNodeParameter('query', itemIndex) as string;
	const page = this.getNodeParameter('page', itemIndex) as number;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const response = await discourseApiRequest.call(this, itemIndex, 'GET', '/search.json', {
		q: query,
		page,
	});

	if (simplify && response && typeof response === 'object' && !Array.isArray(response)) {
		const responseData = response as IDataObject;
		const posts =
			Array.isArray(responseData.posts) && responseData.posts.length > 0
				? responseData.posts
				: [];

		return toExecutionData(
			itemIndex,
			posts
				.filter((post): post is IDataObject => !!post && typeof post === 'object')
				.map((post) => simplifyPost(post)),
		);
	}

	return toExecutionData(itemIndex, response);
}

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { simplifyPost, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { resolvePostId } from '../helpers';

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ['get'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Post ID or URL',
		name: 'postId',
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
				placeholder: '456',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				placeholder: 'https://forum.example.com/p/456 or https://forum.example.com/t/topic-slug/123/4',
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
	const postIdInput = this.getNodeParameter('postId', itemIndex);
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	let postId: number;
	try {
		postId = await resolvePostId.call(this, itemIndex, postIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const response = await discourseApiRequest.call(this, itemIndex, 'GET', `/posts/${postId}.json`);

	if (simplify && response && typeof response === 'object' && !Array.isArray(response)) {
		return toExecutionData(itemIndex, simplifyPost(response as IDataObject));
	}

	return toExecutionData(itemIndex, response);
}

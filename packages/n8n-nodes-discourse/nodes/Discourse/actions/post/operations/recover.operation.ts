import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { toExecutionData } from '../../utils';
import { discourseApiRequestWithPathFallback, resolvePostId } from '../helpers';

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ['recover'],
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
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const postIdInput = this.getNodeParameter('postId', itemIndex);

	let postId: number;
	try {
		postId = await resolvePostId.call(this, itemIndex, postIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const response = await discourseApiRequestWithPathFallback.call(this, itemIndex, 'PUT', [
		`/posts/${postId}/recover`,
		`/posts/${postId}/recover.json`,
	]);

	return toExecutionData(itemIndex, {
		action: 'recover',
		post_id: postId,
		response,
		success: true,
	});
}

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { toExecutionData } from '../../utils';
import { discourseApiRequestWithPathFallback, resolvePostId } from '../helpers';

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ['unlike'],
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

const LIKE_POST_ACTION_TYPE = 2;

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

	const qs: IDataObject = {
		post_action_type_id: LIKE_POST_ACTION_TYPE,
	};

	await discourseApiRequestWithPathFallback.call(
		this,
		itemIndex,
		'DELETE',
		[`/post_actions/${postId}.json`, `/post_actions/${postId}`],
		qs,
	);

	return toExecutionData(itemIndex, {
		action: 'unlike',
		post_id: postId,
		success: true,
	});
}

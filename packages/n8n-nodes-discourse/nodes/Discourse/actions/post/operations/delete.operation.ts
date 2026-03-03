import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { resolvePostId } from '../helpers';

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ['delete'],
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
		displayName: 'Force Destroy',
		name: 'forceDestroy',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether to permanently delete the post instead of performing a soft delete',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const postIdInput = this.getNodeParameter('postId', itemIndex);
	const forceDestroy = this.getNodeParameter('forceDestroy', itemIndex, false) as boolean;

	let postId: number;
	try {
		postId = await resolvePostId.call(this, itemIndex, postIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const qs: IDataObject = {};
	if (forceDestroy) {
		qs.force_destroy = 'true';
	}

	await discourseApiRequest.call(this, itemIndex, 'DELETE', `/posts/${postId}.json`, qs);

	return toExecutionData(itemIndex, { deleted: true, force_destroy: forceDestroy });
}

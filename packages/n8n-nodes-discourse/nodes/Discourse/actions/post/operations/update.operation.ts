import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { resolvePostId } from '../helpers';

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ['update'],
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
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		default: {},
		displayOptions,
		placeholder: 'Add Field',
		options: [
			{
				displayName: 'Edit Reason',
				name: 'editReason',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Raw',
				name: 'raw',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
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

	const updateFields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
	const post: IDataObject = {};

	if ('raw' in updateFields && typeof updateFields.raw === 'string') {
		const raw = updateFields.raw.trim();
		if (raw) {
			post.raw = raw;
		}
	}

	if ('editReason' in updateFields && typeof updateFields.editReason === 'string') {
		const editReason = updateFields.editReason.trim();
		if (editReason) {
			post.edit_reason = editReason;
		}
	}

	if (Object.keys(post).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Provide at least one update field.', {
			itemIndex,
		});
	}

	const response = await discourseApiRequest.call(this, itemIndex, 'PUT', `/posts/${postId}.json`, {}, { post });

	return toExecutionData(itemIndex, response);
}

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { toExecutionData } from '../../utils';
import { discourseApiRequestWithPathFallback, resolvePostId, simplifyPostRevision } from '../helpers';

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ['getRevisionVersion'],
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
		displayName: 'Version',
		name: 'version',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 1,
		required: true,
		displayOptions,
		description: 'Revision version number to fetch',
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
	const version = this.getNodeParameter('version', itemIndex) as number;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	let postId: number;
	try {
		postId = await resolvePostId.call(this, itemIndex, postIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const revisionVersion = Math.trunc(version);
	if (revisionVersion < 1) {
		throw new NodeOperationError(this.getNode(), 'Version must be at least 1.', { itemIndex });
	}

	const response = await discourseApiRequestWithPathFallback.call(this, itemIndex, 'GET', [
		`/posts/${postId}/revisions/${revisionVersion}.json`,
		`/posts/${postId}/revisions/${revisionVersion}`,
	]);

	if (simplify && response && typeof response === 'object' && !Array.isArray(response)) {
		return toExecutionData(itemIndex, simplifyPostRevision(response as IDataObject));
	}

	return toExecutionData(itemIndex, response);
}

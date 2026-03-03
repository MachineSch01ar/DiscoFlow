import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getTopicId, simplifyPost, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { getPostListFromResponse, getPostStreamIds } from '../helpers';

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ['getManyTopic'],
	},
};

const limitDisplayOptions = {
	show: {
		resource: ['post'],
		operation: ['getManyTopic'],
		returnAll: [false],
	},
};

const POST_IDS_BATCH_SIZE = 20;

export const description: INodeProperties[] = [
	{
		displayName: 'Topic ID or URL',
		name: 'topicId',
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
				placeholder: '123',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				placeholder: 'https://forum.example.com/t/topic-slug/123',
				extractValue: {
					type: 'regex',
					regex: '/t/(?:[^/]+/)?(\\d+)',
				},
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 50,
		displayOptions: limitDisplayOptions,
		description: 'Max number of results to return',
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

function addPosts(target: IDataObject[], seenPostIds: Set<number>, incomingPosts: IDataObject[], remaining: number) {
	let remainingCount = remaining;

	for (const post of incomingPosts) {
		const postId = Number(post.id ?? 0);
		if (postId > 0 && !seenPostIds.has(postId)) {
			seenPostIds.add(postId);
			target.push(post);
			remainingCount -= 1;
			if (remainingCount <= 0) {
				break;
			}
		}
	}

	return remainingCount;
}

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const topicIdInput = this.getNodeParameter('topicId', itemIndex);
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	let topicId: number;
	try {
		topicId = getTopicId(topicIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const response = await discourseApiRequest.call(this, itemIndex, 'GET', `/t/${topicId}.json`);
	const streamPostIds = getPostStreamIds(response);
	const collectedPosts: IDataObject[] = [];
	const seenPostIds = new Set<number>();
	let remaining = returnAll
		? streamPostIds.length > 0
			? streamPostIds.length
			: Number.POSITIVE_INFINITY
		: limit;

	remaining = addPosts(collectedPosts, seenPostIds, getPostListFromResponse(response), remaining);

	if (remaining > 0 && streamPostIds.length > 0) {
		const missingPostIds = streamPostIds.filter((postId) => !seenPostIds.has(postId));

		for (let index = 0; index < missingPostIds.length && remaining > 0; index += POST_IDS_BATCH_SIZE) {
			const batch = missingPostIds.slice(index, index + POST_IDS_BATCH_SIZE);
			const batchResponse = await discourseApiRequest.call(
				this,
				itemIndex,
				'GET',
				`/t/${topicId}/posts.json`,
				{
					'post_ids[]': batch,
				},
			);

			remaining = addPosts(collectedPosts, seenPostIds, getPostListFromResponse(batchResponse), remaining);
		}
	}

	const selectedPosts = returnAll ? collectedPosts : collectedPosts.slice(0, limit);
	if (simplify) {
		return toExecutionData(itemIndex, selectedPosts.map((post) => simplifyPost(post)));
	}

	return toExecutionData(itemIndex, selectedPosts);
}

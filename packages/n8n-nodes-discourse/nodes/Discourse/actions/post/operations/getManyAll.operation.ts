import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { simplifyPost, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { getPostListFromResponse } from '../helpers';

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ['getManyAll'],
	},
};

const limitDisplayOptions = {
	show: {
		resource: ['post'],
		operation: ['getManyAll'],
		returnAll: [false],
	},
};

const MAX_PAGES = 100;

export const description: INodeProperties[] = [
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
		displayName: 'Before',
		name: 'before',
		type: 'number',
		default: 0,
		typeOptions: {
			minValue: 0,
		},
		displayOptions,
		description: 'Optional post ID cursor to return older posts',
	},
	{
		displayName: 'Page',
		name: 'page',
		type: 'number',
		default: 0,
		typeOptions: {
			minValue: 0,
		},
		displayOptions,
		description: 'Optional page index used for the first request only',
	},
	{
		displayName: 'Order',
		name: 'order',
		type: 'options',
		default: '',
		displayOptions,
		options: [
			{
				name: 'Default',
				value: '',
			},
			{
				name: 'Activity',
				value: 'activity',
			},
			{
				name: 'Created',
				value: 'created',
			},
		],
	},
	{
		displayName: 'Ascending',
		name: 'ascending',
		type: 'boolean',
		default: false,
		displayOptions,
	},
	{
		displayName: 'Desc',
		name: 'desc',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether to request descending order when supported by the instance',
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
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
	const beforeInput = this.getNodeParameter('before', itemIndex, 0) as number;
	const page = this.getNodeParameter('page', itemIndex, 0) as number;
	const order = this.getNodeParameter('order', itemIndex, '') as string;
	const ascending = this.getNodeParameter('ascending', itemIndex, false) as boolean;
	const desc = this.getNodeParameter('desc', itemIndex, false) as boolean;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const responses: unknown[] = [];
	const posts: IDataObject[] = [];
	const seenPostIds = new Set<number>();
	let remaining = returnAll ? Number.POSITIVE_INFINITY : limit;
	let before = beforeInput > 0 ? beforeInput : undefined;

	for (let pageIndex = 0; pageIndex < MAX_PAGES && remaining > 0; pageIndex++) {
		const qs: IDataObject = {};

		if (order) {
			qs.order = order;
		}

		if (ascending) {
			qs.ascending = true;
		}

		if (desc) {
			qs.desc = true;
		}

		if (before !== undefined && before > 0) {
			qs.before = before;
		}

		if (pageIndex === 0 && page > 0) {
			qs.page = page;
		}

		const response = await discourseApiRequest.call(this, itemIndex, 'GET', '/posts.json', qs);
		responses.push(response);

		const pagePosts = getPostListFromResponse(response);
		if (pagePosts.length === 0) {
			break;
		}

		let minPostId = Number.POSITIVE_INFINITY;
		for (const post of pagePosts) {
			const postId = Number(post.id ?? 0);
			if (postId > 0 && !seenPostIds.has(postId)) {
				seenPostIds.add(postId);
				posts.push(post);
				remaining -= 1;
				if (postId < minPostId) {
					minPostId = postId;
				}
				if (!returnAll && remaining <= 0) {
					break;
				}
			}
		}

		if (!Number.isFinite(minPostId) || minPostId <= 1) {
			break;
		}

		const nextBefore = minPostId - 1;
		if (before !== undefined && nextBefore >= before) {
			break;
		}

		before = nextBefore;
	}

	if (simplify) {
		const selectedPosts = returnAll ? posts : posts.slice(0, limit);
		return toExecutionData(itemIndex, selectedPosts.map((post) => simplifyPost(post)));
	}

	const selectedPosts = returnAll ? posts : posts.slice(0, limit);
	if (selectedPosts.length > 0) {
		return toExecutionData(itemIndex, selectedPosts);
	}

	if (responses.length === 1) {
		return toExecutionData(itemIndex, responses[0]);
	}

	return toExecutionData(itemIndex, responses);
}

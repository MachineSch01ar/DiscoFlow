import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { simplifyPost, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { getUserPostsFromResponse } from '../helpers';

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ['getManyUser'],
	},
};

const limitDisplayOptions = {
	show: {
		resource: ['post'],
		operation: ['getManyUser'],
		returnAll: [false],
	},
};

const MAX_PAGES = 50;
const USER_ACTIONS_PAGE_SIZE = 30;

function appendPosts(target: IDataObject[], incomingPosts: IDataObject[], remaining: number): number {
	let remainingCount = remaining;

	for (const post of incomingPosts) {
		target.push(post);
		remainingCount -= 1;
		if (remainingCount <= 0) {
			break;
		}
	}

	return remainingCount;
}

export const description: INodeProperties[] = [
	{
		displayName: 'Username',
		name: 'username',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Username whose post activity should be listed',
	},
	{
		displayName: 'Page',
		name: 'page',
		type: 'number',
		typeOptions: {
			minValue: 0,
		},
		default: 0,
		displayOptions,
		description: 'Optional start page index for activity listing',
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

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const username = (this.getNodeParameter('username', itemIndex) as string).trim();
	const page = this.getNodeParameter('page', itemIndex, 0) as number;
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	if (!username) {
		throw new NodeOperationError(this.getNode(), 'Username is required.', { itemIndex });
	}

	const posts: IDataObject[] = [];
	let remaining = returnAll ? Number.POSITIVE_INFINITY : limit;
	let fetchedFromActivity = false;

	for (let currentPage = page; currentPage < page + MAX_PAGES && remaining > 0; currentPage++) {
		const qs: IDataObject = {};
		if (currentPage > 0) {
			qs.page = currentPage;
		}

		const response = await discourseApiRequest.call(
			this,
			itemIndex,
			'GET',
			`/u/${encodeURIComponent(username)}/activity/posts.json`,
			qs,
		);

		const pagePosts = getUserPostsFromResponse(response);
		if (pagePosts.length === 0) {
			break;
		}

		fetchedFromActivity = true;
		remaining = appendPosts(posts, pagePosts, remaining);

		if (pagePosts.length < USER_ACTIONS_PAGE_SIZE) {
			break;
		}
	}

	if (!fetchedFromActivity && remaining > 0) {
		let offset = page * USER_ACTIONS_PAGE_SIZE;

		for (let pageIndex = 0; pageIndex < MAX_PAGES && remaining > 0; pageIndex++) {
			const response = await discourseApiRequest.call(this, itemIndex, 'GET', '/user_actions.json', {
				username,
				filter: 5,
				offset,
			});

			const pagePosts = getUserPostsFromResponse(response);
			if (pagePosts.length === 0) {
				break;
			}

			remaining = appendPosts(posts, pagePosts, remaining);
			offset += pagePosts.length;

			if (pagePosts.length < USER_ACTIONS_PAGE_SIZE) {
				break;
			}
		}
	}

	const selectedPosts = returnAll ? posts : posts.slice(0, limit);
	if (simplify) {
		return toExecutionData(itemIndex, selectedPosts.map((post) => simplifyPost(post)));
	}

	return toExecutionData(itemIndex, selectedPosts);
}

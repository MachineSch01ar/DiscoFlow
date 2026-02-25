import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { simplifyTopic, toExecutionData, getTopicsFromResponse } from '../../utils';
import { discourseApiRequest } from '../../../transport';

const displayOptions = {
	show: {
		resource: ['topic'],
		operation: ['getManyLatest'],
	},
};

const limitDisplayOptions = {
	show: {
		resource: ['topic'],
		operation: ['getManyLatest'],
		returnAll: [false],
	},
};

const MAX_PAGES = 100;
const PAGE_SIZE = 100;

function parseQueryString(queryString: string): IDataObject {
	const query: IDataObject = {};
	for (const pair of queryString.split('&')) {
		if (!pair) {
			continue;
		}

		const [rawKey, rawValue = ''] = pair.split('=', 2);
		if (!rawKey) {
			continue;
		}

		query[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
	}

	return query;
}

function parseMoreTopicsUrl(moreTopicsUrl: string): { path: string; qs: IDataObject } | null {
	const [rawPath, rawQueryString] = moreTopicsUrl.split('?', 2);
	if (!rawPath) {
		return null;
	}

	const normalizedPath = rawPath.endsWith('.json') ? rawPath : `${rawPath}.json`;
	const qs: IDataObject = rawQueryString ? parseQueryString(rawQueryString) : {};

	return {
		path: normalizedPath,
		qs,
	};
}

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
		default: 50,
		typeOptions: {
			minValue: 1,
		},
		displayOptions: limitDisplayOptions,
		description: 'Max number of results to return',
	},
	{
		displayName: 'Order',
		name: 'order',
		type: 'options',
		default: '',
		displayOptions,
		options: [
			{
				name: 'Activity',
				value: 'activity',
			},
			{
				name: 'Category',
				value: 'category',
			},
			{
				name: 'Created',
				value: 'created',
			},
			{
				name: 'Default',
				value: '',
			},
			{
				name: 'Posts',
				value: 'posts',
			},
			{
				name: 'Views',
				value: 'views',
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
	const order = this.getNodeParameter('order', itemIndex) as string;
	const ascending = this.getNodeParameter('ascending', itemIndex) as boolean;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const responses: unknown[] = [];
	const topics: IDataObject[] = [];
	let remaining = returnAll ? Number.POSITIVE_INFINITY : limit;
	let nextPath = '/latest.json';
	let nextQs: IDataObject = {
		order,
		ascending,
		per_page: Math.min(PAGE_SIZE, remaining),
	};

	for (let page = 0; page < MAX_PAGES && remaining > 0; page++) {
		const response = await discourseApiRequest.call(this, itemIndex, 'GET', nextPath, nextQs);
		responses.push(response);

		const pageTopics = getTopicsFromResponse(response);
		if (pageTopics.length === 0) {
			break;
		}

		if (returnAll) {
			topics.push(...pageTopics);
		} else {
			topics.push(...pageTopics.slice(0, remaining));
			remaining -= pageTopics.length;
		}

		const responseData =
			response && typeof response === 'object' && !Array.isArray(response)
				? (response as IDataObject)
				: {};
		const topicList = responseData.topic_list as IDataObject | undefined;
		const moreTopicsUrl = topicList?.more_topics_url;
		if (typeof moreTopicsUrl !== 'string' || !moreTopicsUrl) {
			break;
		}

		const parsedMoreTopicsUrl = parseMoreTopicsUrl(moreTopicsUrl);
		if (!parsedMoreTopicsUrl) {
			break;
		}

		nextPath = parsedMoreTopicsUrl.path;
		nextQs = {
			...parsedMoreTopicsUrl.qs,
			order,
			ascending,
			per_page: Math.min(PAGE_SIZE, remaining),
		};
	}

	if (simplify) {
		return toExecutionData(
			itemIndex,
			topics.slice(0, returnAll ? topics.length : limit).map((topic) => simplifyTopic(topic)),
		);
	}

	if (responses.length === 1) {
		return toExecutionData(itemIndex, responses[0]);
	}

	return toExecutionData(itemIndex, responses);
}

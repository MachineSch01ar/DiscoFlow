import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { simplifyTopic, toExecutionData, getTopicsFromResponse } from '../../utils';
import { discourseApiRequest } from '../../../transport';

const displayOptions = {
	show: {
		resource: ['topic'],
		operation: ['getManyTop'],
	},
};

const limitDisplayOptions = {
	show: {
		resource: ['topic'],
		operation: ['getManyTop'],
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
		displayName: 'Period',
		name: 'period',
		type: 'options',
		default: 'all',
		displayOptions,
		options: [
			{
				name: 'All',
				value: 'all',
			},
			{
				name: 'Daily',
				value: 'daily',
			},
			{
				name: 'Monthly',
				value: 'monthly',
			},
			{
				name: 'Quarterly',
				value: 'quarterly',
			},
			{
				name: 'Weekly',
				value: 'weekly',
			},
			{
				name: 'Yearly',
				value: 'yearly',
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
		default: 50,
		typeOptions: {
			minValue: 1,
		},
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
	const period = this.getNodeParameter('period', itemIndex) as string;
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const responses: unknown[] = [];
	const topics: IDataObject[] = [];
	let remaining = returnAll ? Number.POSITIVE_INFINITY : limit;
	let nextPath = '/top.json';
	let nextQs: IDataObject = {
		period,
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
			period,
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

import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getArtifactId, toExecutionData } from '../../utils';
import { extractArtifactKeyValuesEnvelope, listArtifactKeyValues } from '../api';

const displayOptions = {
	show: {
		resource: ['aiArtifactStorage'],
		operation: ['getMany'],
	},
};

const limitDisplayOptions = {
	show: {
		resource: ['aiArtifactStorage'],
		operation: ['getMany'],
		returnAll: [false],
	},
};

const MAX_PAGES = 200;
const MAX_PER_PAGE = 100;

function normalizePage(value: number): number {
	if (!Number.isFinite(value) || value < 1) {
		return 1;
	}

	return Math.trunc(value);
}

function normalizePerPage(value: number): number {
	if (!Number.isFinite(value) || value < 1) {
		return 50;
	}

	return Math.min(Math.trunc(value), MAX_PER_PAGE);
}

function addUsersToMap(userMap: Map<number, IDataObject>, users: IDataObject[]): void {
	for (const user of users) {
		const userId = Number(user.id);
		if (!Number.isInteger(userId) || userId <= 0) {
			continue;
		}

		userMap.set(userId, user);
	}
}

function mapRowsWithUsers(rows: IDataObject[], users: IDataObject[]): IDataObject[] {
	const userMap = new Map<number, IDataObject>();
	addUsersToMap(userMap, users);

	return rows.map((row) => {
		const userId = Number(row.user_id);
		if (Number.isInteger(userId) && userId > 0 && userMap.has(userId)) {
			return {
				...row,
				user: userMap.get(userId),
			};
		}

		return { ...row };
	});
}

export const description: INodeProperties[] = [
	{
		displayName: 'Artifact ID or URL',
		name: 'artifactId',
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
				placeholder: 'https://forum.example.com/admin/plugins/discourse-ai/ai-artifacts/123',
				extractValue: {
					type: 'regex',
					regex: '(?:/ai-artifacts/|/ai-bot/artifacts/)(\\d+)',
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
		displayName: 'Page',
		name: 'page',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 1,
		displayOptions,
		description: 'Page number to start listing from',
	},
	{
		displayName: 'Per Page',
		name: 'perPage',
		type: 'number',
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 50,
		displayOptions,
		description: 'Number of entries per request. Maximum is 100.',
	},
	{
		displayName: 'Key',
		name: 'key',
		type: 'string',
		default: '',
		displayOptions,
		description: 'Optional key filter',
	},
	{
		displayName: 'Keys Only',
		name: 'keysOnly',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether to return only keys in each row',
	},
	{
		displayName: 'All Users',
		name: 'allUsers',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether to request rows across all users when permitted',
	},
	{
		displayName: 'Output Mode',
		name: 'outputMode',
		type: 'options',
		default: 'rows',
		displayOptions,
		options: [
			{
				name: 'Rows',
				value: 'rows',
			},
			{
				name: 'Response',
				value: 'response',
			},
		],
		description: 'Whether to return one item per row or a single response envelope',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const artifactIdInput = this.getNodeParameter('artifactId', itemIndex);
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
	const page = this.getNodeParameter('page', itemIndex, 1) as number;
	const perPage = this.getNodeParameter('perPage', itemIndex, 50) as number;
	const key = (this.getNodeParameter('key', itemIndex, '') as string).trim();
	const keysOnly = this.getNodeParameter('keysOnly', itemIndex, false) as boolean;
	const allUsers = this.getNodeParameter('allUsers', itemIndex, false) as boolean;
	const outputMode = this.getNodeParameter('outputMode', itemIndex, 'rows') as 'rows' | 'response';

	let artifactId: number;
	try {
		artifactId = getArtifactId(artifactIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const startPage = normalizePage(page);
	const perPageValue = normalizePerPage(perPage);
	const limitValue = Math.max(1, Math.trunc(limit));

	if (!returnAll) {
		const response = await listArtifactKeyValues.call(this, itemIndex, artifactId, {
			page: startPage,
			per_page: Math.min(perPageValue, limitValue),
			key: key || undefined,
			keys_only: keysOnly ? 'true' : undefined,
			all_users: allUsers ? 'true' : undefined,
		});

		const envelope = extractArtifactKeyValuesEnvelope(response);
		const limitedRows = envelope.keyValues.slice(0, limitValue);

		if (outputMode === 'response') {
			const responsePayload: IDataObject = {
				...envelope.raw,
				key_values: limitedRows,
				users: envelope.users,
				has_more: envelope.hasMore,
				total_count: envelope.totalCount ?? limitedRows.length,
			};
			return toExecutionData(itemIndex, responsePayload);
		}

		return toExecutionData(itemIndex, mapRowsWithUsers(limitedRows, envelope.users));
	}

	let currentPage = startPage;
	let totalCount: number | undefined;
	const aggregatedRows: IDataObject[] = [];
	const userMap = new Map<number, IDataObject>();

	for (let pageCount = 0; pageCount < MAX_PAGES; pageCount++) {
		const response = await listArtifactKeyValues.call(this, itemIndex, artifactId, {
			page: currentPage,
			per_page: perPageValue,
			key: key || undefined,
			keys_only: keysOnly ? 'true' : undefined,
			all_users: allUsers ? 'true' : undefined,
		});

		const envelope = extractArtifactKeyValuesEnvelope(response);
		if (totalCount === undefined && envelope.totalCount !== undefined) {
			totalCount = envelope.totalCount;
		}

		if (envelope.keyValues.length === 0) {
			break;
		}

		aggregatedRows.push(...envelope.keyValues);
		addUsersToMap(userMap, envelope.users);

		if (!envelope.hasMore) {
			break;
		}

		currentPage += 1;
	}

	const aggregatedUsers = Array.from(userMap.values());

	if (outputMode === 'response') {
		return toExecutionData(itemIndex, {
			key_values: aggregatedRows,
			users: aggregatedUsers,
			has_more: false,
			total_count: totalCount ?? aggregatedRows.length,
		});
	}

	return toExecutionData(itemIndex, mapRowsWithUsers(aggregatedRows, aggregatedUsers));
}

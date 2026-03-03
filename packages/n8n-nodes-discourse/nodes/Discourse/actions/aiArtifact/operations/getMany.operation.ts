import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { simplifyAiArtifact, toExecutionData } from '../../utils';
import { extractAiArtifactList, listAiArtifacts } from '../api';

const displayOptions = {
	show: {
		resource: ['aiArtifact'],
		operation: ['getMany'],
	},
};

const limitDisplayOptions = {
	show: {
		resource: ['aiArtifact'],
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
		description: 'Number of artifacts per request. Maximum is 100.',
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
	const page = this.getNodeParameter('page', itemIndex, 1) as number;
	const perPage = this.getNodeParameter('perPage', itemIndex, 50) as number;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const startPage = normalizePage(page);
	const perPageValue = normalizePerPage(perPage);

	if (!returnAll) {
		const requestPerPage = Math.min(perPageValue, Math.trunc(limit));
		const response = await listAiArtifacts.call(this, itemIndex, {
			page: startPage,
			per_page: requestPerPage,
		});
		const { artifacts } = extractAiArtifactList(response);
		const selectedArtifacts = artifacts.slice(0, Math.trunc(limit));
		const output = simplify
			? selectedArtifacts.map((artifact) => simplifyAiArtifact(artifact))
			: selectedArtifacts;

		return toExecutionData(itemIndex, output);
	}

	const artifacts: IDataObject[] = [];
	let currentPage = startPage;

	for (let pageCount = 0; pageCount < MAX_PAGES; pageCount++) {
		const response = await listAiArtifacts.call(this, itemIndex, {
			page: currentPage,
			per_page: perPageValue,
		});

		const { artifacts: pageArtifacts, meta } = extractAiArtifactList(response);
		if (pageArtifacts.length === 0) {
			break;
		}

		artifacts.push(...pageArtifacts);
		if (!meta.has_more) {
			break;
		}

		currentPage += 1;
	}

	const output = simplify ? artifacts.map((artifact) => simplifyAiArtifact(artifact)) : artifacts;
	return toExecutionData(itemIndex, output);
}

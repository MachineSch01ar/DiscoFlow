import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getQueryId, simplifyDataExplorerQuery, toExecutionData } from '../../utils';
import { extractDataExplorerQuery, getQuery } from '../api';

const displayOptions = {
	show: {
		resource: ['dataExplorer'],
		operation: ['get'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Query ID or URL',
		name: 'queryId',
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
				placeholder: '42',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				placeholder: 'https://forum.example.com/admin/plugins/discourse-data-explorer/queries/42',
				extractValue: {
					type: 'regex',
					regex: '(?:/queries/|[?&]id=)(\\d+)',
				},
			},
		],
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
	const queryIdInput = this.getNodeParameter('queryId', itemIndex);
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	let queryId: number;
	try {
		queryId = getQueryId(queryIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const response = await getQuery.call(this, itemIndex, queryId);
	if (simplify) {
		const query = extractDataExplorerQuery(response);
		if (query) {
			return toExecutionData(itemIndex, simplifyDataExplorerQuery(query as IDataObject));
		}
	}

	return toExecutionData(itemIndex, response);
}

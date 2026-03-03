import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { simplifyDataExplorerQuery, toExecutionData } from '../../utils';
import { extractDataExplorerQueries, listQueries } from '../api';

const displayOptions = {
	show: {
		resource: ['dataExplorer'],
		operation: ['getMany'],
	},
};

const limitDisplayOptions = {
	show: {
		resource: ['dataExplorer'],
		operation: ['getMany'],
		returnAll: [false],
	},
};

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
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const response = await listQueries.call(this, itemIndex);
	const queries = extractDataExplorerQueries(response);
	const selectedQueries = returnAll ? queries : queries.slice(0, limit);
	const output = simplify
		? selectedQueries.map((query) => simplifyDataExplorerQuery(query))
		: selectedQueries;

	return toExecutionData(itemIndex, output as IDataObject[]);
}

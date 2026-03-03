import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { simplifyDataExplorerQuery, toExecutionData } from '../../utils';
import { createQuery, extractDataExplorerQuery } from '../api';
import { parseParamsInput } from './helpers';

const displayOptions = {
	show: {
		resource: ['dataExplorer'],
		operation: ['create'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Query Name',
		name: 'queryName',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
	},
	{
		displayName: 'SQL',
		name: 'sql',
		type: 'string',
		typeOptions: {
			rows: 8,
		},
		default: '',
		required: true,
		displayOptions,
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		displayOptions,
	},
	{
		displayName: 'Params JSON',
		name: 'paramsJson',
		type: 'json',
		default: '',
		displayOptions,
		description:
			'Optional JSON object of query parameters. Example: {"min_posts":{"type":"int","default":"10"}}.',
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
	const queryName = this.getNodeParameter('queryName', itemIndex) as string;
	const sql = this.getNodeParameter('sql', itemIndex) as string;
	const description = this.getNodeParameter('description', itemIndex, '') as string;
	const paramsInput = this.getNodeParameter('paramsJson', itemIndex, '');
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	let params: IDataObject | undefined;
	try {
		params = parseParamsInput(paramsInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const payload: {
		name: string;
		sql: string;
		description?: string;
		params?: IDataObject;
	} = {
		name: queryName,
		sql,
	};

	if (description.trim()) {
		payload.description = description;
	}

	if (params) {
		payload.params = params;
	}

	const response = await createQuery.call(this, itemIndex, payload);
	if (simplify) {
		const query = extractDataExplorerQuery(response);
		if (query) {
			return toExecutionData(itemIndex, simplifyDataExplorerQuery(query));
		}
	}

	return toExecutionData(itemIndex, response);
}

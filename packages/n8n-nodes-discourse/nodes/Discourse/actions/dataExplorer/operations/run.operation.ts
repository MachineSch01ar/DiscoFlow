import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getQueryId, toExecutionData } from '../../utils';
import { extractDataExplorerRunResult, runQuery } from '../api';
import { parseParamsInput } from './helpers';

const displayOptions = {
	show: {
		resource: ['dataExplorer'],
		operation: ['run'],
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
		displayName: 'Params JSON',
		name: 'paramsJson',
		type: 'json',
		default: '',
		displayOptions,
		description: 'Optional JSON object with run parameters. Example: {"min_posts":10}.',
	},
	{
		displayName: 'Result Only',
		name: 'resultOnly',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether to return only columns and rows instead of the full response',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const queryIdInput = this.getNodeParameter('queryId', itemIndex);
	const paramsInput = this.getNodeParameter('paramsJson', itemIndex, '');
	const resultOnly = this.getNodeParameter('resultOnly', itemIndex, false) as boolean;

	let queryId: number;
	try {
		queryId = getQueryId(queryIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	let params: IDataObject | undefined;
	try {
		params = parseParamsInput(paramsInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const response = await runQuery.call(this, itemIndex, queryId, params);
	if (resultOnly) {
		return toExecutionData(itemIndex, extractDataExplorerRunResult(response));
	}

	return toExecutionData(itemIndex, response);
}

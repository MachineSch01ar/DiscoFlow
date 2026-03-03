import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getQueryId, simplifyDataExplorerQuery, toExecutionData } from '../../utils';
import { extractDataExplorerQuery, updateQuery } from '../api';
import { parseParamsInput } from './helpers';

const displayOptions = {
	show: {
		resource: ['dataExplorer'],
		operation: ['update'],
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
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		default: {},
		displayOptions,
		placeholder: 'Add Field',
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
			},
			{
				displayName: 'Params JSON',
				name: 'paramsJson',
				type: 'json',
				default: '',
			},
			{
				displayName: 'Query Name',
				name: 'queryName',
				type: 'string',
				default: '',
			},
			{
				displayName: 'SQL',
				name: 'sql',
				type: 'string',
				typeOptions: {
					rows: 8,
				},
				default: '',
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
	const updateFields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	let queryId: number;
	try {
		queryId = getQueryId(queryIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const payload: {
		name?: string;
		sql?: string;
		description?: string;
		params?: IDataObject;
	} = {};

	if ('queryName' in updateFields && typeof updateFields.queryName === 'string') {
		const name = updateFields.queryName.trim();
		if (!name) {
			throw new NodeOperationError(this.getNode(), 'Query Name cannot be empty.', { itemIndex });
		}

		payload.name = name;
	}

	if ('sql' in updateFields && typeof updateFields.sql === 'string') {
		const sql = updateFields.sql.trim();
		if (!sql) {
			throw new NodeOperationError(this.getNode(), 'SQL cannot be empty.', { itemIndex });
		}

		payload.sql = sql;
	}

	if ('description' in updateFields && typeof updateFields.description === 'string') {
		payload.description = updateFields.description;
	}

	if ('paramsJson' in updateFields) {
		try {
			const params = parseParamsInput(updateFields.paramsJson);
			if (params) {
				payload.params = params;
			}
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
		}
	}

	if (Object.keys(payload).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Provide at least one update field.', {
			itemIndex,
		});
	}

	const response = await updateQuery.call(this, itemIndex, queryId, payload);
	if (simplify) {
		const query = extractDataExplorerQuery(response);
		if (query) {
			return toExecutionData(itemIndex, simplifyDataExplorerQuery(query));
		}
	}

	return toExecutionData(itemIndex, response);
}

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getQueryId, toExecutionData } from '../../utils';
import { deleteQuery } from '../api';

const displayOptions = {
	show: {
		resource: ['dataExplorer'],
		operation: ['delete'],
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
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const queryIdInput = this.getNodeParameter('queryId', itemIndex);
	let queryId: number;

	try {
		queryId = getQueryId(queryIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	await deleteQuery.call(this, itemIndex, queryId);

	return toExecutionData(itemIndex, { deleted: true });
}

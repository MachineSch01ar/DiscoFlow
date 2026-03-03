import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getArtifactId, toExecutionData } from '../../utils';
import { findStorageEntryByKey, normalizeStorageKey, toStorageKeyValuePayload } from './helpers';

const displayOptions = {
	show: {
		resource: ['aiArtifactStorage'],
		operation: ['get'],
	},
};

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
		displayName: 'Key',
		name: 'key',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Storage key to fetch',
	},
	{
		displayName: 'Output Mode',
		name: 'outputMode',
		type: 'options',
		default: 'keyValue',
		displayOptions,
		options: [
			{
				name: 'Key/Value',
				value: 'keyValue',
			},
			{
				name: 'Raw',
				value: 'raw',
			},
		],
		description: 'Whether to return compact key/value output or the raw storage row',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const artifactIdInput = this.getNodeParameter('artifactId', itemIndex);
	const keyInput = this.getNodeParameter('key', itemIndex) as string;
	const outputMode = this.getNodeParameter('outputMode', itemIndex, 'keyValue') as 'keyValue' | 'raw';

	let artifactId: number;
	let key: string;
	try {
		artifactId = getArtifactId(artifactIdInput);
		key = normalizeStorageKey(keyInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const storageEntry = await findStorageEntryByKey.call(this, itemIndex, artifactId, key);
	if (!storageEntry) {
		throw new NodeOperationError(
			this.getNode(),
			`Storage key "${key}" was not found for artifact ${artifactId}.`,
			{ itemIndex },
		);
	}

	if (outputMode === 'raw') {
		return toExecutionData(itemIndex, storageEntry);
	}

	return toExecutionData(itemIndex, toStorageKeyValuePayload(storageEntry, artifactId));
}

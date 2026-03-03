import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getArtifactId, toExecutionData } from '../../utils';
import { extractArtifactKeyValueEntry, setArtifactKeyValue } from '../api';
import { findStorageEntryByKey, normalizeStorageKey, toStorageKeyValuePayload } from './helpers';

const displayOptions = {
	show: {
		resource: ['aiArtifactStorage'],
		operation: ['update'],
	},
};

const publicDisplayOptions = {
	show: {
		resource: ['aiArtifactStorage'],
		operation: ['update'],
		updatePublic: [true],
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
		description: 'Storage key to update',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '',
		required: true,
		displayOptions,
		description: 'New string value for the storage key',
	},
	{
		displayName: 'Update Public',
		name: 'updatePublic',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether to overwrite the existing public flag',
	},
	{
		displayName: 'Public',
		name: 'public',
		type: 'boolean',
		default: false,
		displayOptions: publicDisplayOptions,
		description: 'Whether the public flag should be true when Update Public is enabled',
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
		description: 'Whether to return compact key/value output or the raw API response',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const artifactIdInput = this.getNodeParameter('artifactId', itemIndex);
	const keyInput = this.getNodeParameter('key', itemIndex) as string;
	const value = this.getNodeParameter('value', itemIndex) as string;
	const updatePublic = this.getNodeParameter('updatePublic', itemIndex, false) as boolean;
	const publicValue = this.getNodeParameter('public', itemIndex, false) as boolean;
	const outputMode = this.getNodeParameter('outputMode', itemIndex, 'keyValue') as 'keyValue' | 'raw';

	let artifactId: number;
	let key: string;
	try {
		artifactId = getArtifactId(artifactIdInput);
		key = normalizeStorageKey(keyInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const existingEntry = await findStorageEntryByKey.call(this, itemIndex, artifactId, key);
	if (!existingEntry) {
		throw new NodeOperationError(
			this.getNode(),
			`Storage key "${key}" does not exist for artifact ${artifactId}. Use Create or Set instead.`,
			{ itemIndex },
		);
	}

	const body: IDataObject = {
		key,
		value,
	};
	if (updatePublic) {
		body.public = publicValue;
	}

	const response = await setArtifactKeyValue.call(this, itemIndex, artifactId, body);
	if (outputMode === 'raw') {
		return toExecutionData(itemIndex, response);
	}

	const responseEntry = extractArtifactKeyValueEntry(response);
	const payloadEntry: IDataObject = {
		...existingEntry,
		...responseEntry,
		key,
		value,
		public: updatePublic ? publicValue : responseEntry?.public ?? existingEntry.public,
	};

	return toExecutionData(itemIndex, toStorageKeyValuePayload(payloadEntry, artifactId, 'update'));
}

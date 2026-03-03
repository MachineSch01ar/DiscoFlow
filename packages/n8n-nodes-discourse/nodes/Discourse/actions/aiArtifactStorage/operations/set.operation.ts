import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getArtifactId, toExecutionData } from '../../utils';
import { setArtifactKeyValue } from '../api';
import { normalizeStorageKey } from './helpers';

const displayOptions = {
	show: {
		resource: ['aiArtifactStorage'],
		operation: ['set'],
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
		description: 'Storage key to write',
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
		description: 'String value for the storage key',
	},
	{
		displayName: 'Public',
		name: 'public',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether this key should be publicly readable',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const artifactIdInput = this.getNodeParameter('artifactId', itemIndex);
	const keyInput = this.getNodeParameter('key', itemIndex) as string;
	const value = this.getNodeParameter('value', itemIndex) as string;
	const isPublic = this.getNodeParameter('public', itemIndex, false) as boolean;

	let artifactId: number;
	let key: string;
	try {
		artifactId = getArtifactId(artifactIdInput);
		key = normalizeStorageKey(keyInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const body: IDataObject = {
		key,
		value,
		public: isPublic,
	};

	const response = await setArtifactKeyValue.call(this, itemIndex, artifactId, body);
	return toExecutionData(itemIndex, response);
}

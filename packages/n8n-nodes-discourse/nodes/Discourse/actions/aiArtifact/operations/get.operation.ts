import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getArtifactId, simplifyAiArtifact, toExecutionData } from '../../utils';
import { extractAiArtifact, getAiArtifact } from '../api';

const displayOptions = {
	show: {
		resource: ['aiArtifact'],
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
	const artifactIdInput = this.getNodeParameter('artifactId', itemIndex);
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	let artifactId: number;
	try {
		artifactId = getArtifactId(artifactIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const response = await getAiArtifact.call(this, itemIndex, artifactId);
	const artifact = extractAiArtifact(response);
	const output = artifact ?? (response as IDataObject);

	if (simplify && artifact) {
		return toExecutionData(itemIndex, simplifyAiArtifact(artifact));
	}

	return toExecutionData(itemIndex, output);
}

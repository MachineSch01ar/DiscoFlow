import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getArtifactId, toExecutionData } from '../../utils';
import { deleteAiArtifact } from '../api';

const displayOptions = {
	show: {
		resource: ['aiArtifact'],
		operation: ['delete'],
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
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const artifactIdInput = this.getNodeParameter('artifactId', itemIndex);
	let artifactId: number;

	try {
		artifactId = getArtifactId(artifactIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	await deleteAiArtifact.call(this, itemIndex, artifactId);

	return toExecutionData(itemIndex, { deleted: true });
}

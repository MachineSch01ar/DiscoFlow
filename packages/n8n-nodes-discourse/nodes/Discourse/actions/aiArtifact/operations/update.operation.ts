import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getArtifactId, toExecutionData } from '../../utils';
import { extractAiArtifact, updateAiArtifact } from '../api';
import { buildUpdateMetadata, requirePositiveInteger, resolvePostId } from './helpers';

const displayOptions = {
	show: {
		resource: ['aiArtifact'],
		operation: ['update'],
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
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		default: {},
		displayOptions,
		placeholder: 'Add Field',
		options: [
			{
				displayName: 'CSS',
				name: 'css',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'CSS source for the artifact',
			},
			{
				displayName: 'HTML',
				name: 'html',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				description: 'HTML source for the artifact',
			},
			{
				displayName: 'JavaScript',
				name: 'js',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'JavaScript source for the artifact',
			},
			{
				displayName: 'Metadata JSON',
				name: 'metadataJson',
				type: 'json',
				default: '',
				description: 'Optional metadata object. Public field overrides metadata.public.',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Artifact name',
			},
			{
				displayName: 'Post ID or URL',
				name: 'postId',
				type: 'string',
				default: '',
				description: 'Post ID or direct post URL (for example, /p/123)',
			},
			{
				displayName: 'Public',
				name: 'public',
				type: 'boolean',
				default: false,
				description: 'Whether artifact viewer access should be public',
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'User ID that owns the artifact',
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const artifactIdInput = this.getNodeParameter('artifactId', itemIndex);
	const updateFields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;

	let artifactId: number;
	try {
		artifactId = getArtifactId(artifactIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const payload: IDataObject = {};

	try {
		if (updateFields.userId !== undefined) {
			payload.user_id = requirePositiveInteger(updateFields.userId, 'User ID');
		}

		if (updateFields.postId !== undefined && String(updateFields.postId).trim() !== '') {
			payload.post_id = resolvePostId(updateFields.postId);
		}

		if (updateFields.name !== undefined) {
			payload.name = updateFields.name;
		}

		if (updateFields.html !== undefined) {
			payload.html = updateFields.html;
		}

		if (updateFields.css !== undefined) {
			payload.css = updateFields.css;
		}

		if (updateFields.js !== undefined) {
			payload.js = updateFields.js;
		}

		const hasPublicField = Object.prototype.hasOwnProperty.call(updateFields, 'public');
		const metadata = buildUpdateMetadata(
			updateFields.metadataJson,
			hasPublicField,
			Boolean(updateFields.public),
		);
		if (metadata) {
			payload.metadata = metadata;
		}
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	if (Object.keys(payload).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Provide at least one update field.', {
			itemIndex,
		});
	}

	const response = await updateAiArtifact.call(this, itemIndex, artifactId, payload);
	const artifact = extractAiArtifact(response);

	return toExecutionData(itemIndex, artifact ?? response);
}

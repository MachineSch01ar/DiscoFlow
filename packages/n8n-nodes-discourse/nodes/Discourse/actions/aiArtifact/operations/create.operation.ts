import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { toExecutionData } from '../../utils';
import { createAiArtifact, extractAiArtifact } from '../api';
import { buildCreateMetadata, requirePositiveInteger, resolvePostId } from './helpers';

const displayOptions = {
	show: {
		resource: ['aiArtifact'],
		operation: ['create'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 1,
		required: true,
		displayOptions,
		description: 'User ID that owns the artifact',
	},
	{
		displayName: 'Post ID or URL',
		name: 'postId',
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
				placeholder: 'https://forum.example.com/p/123',
				extractValue: {
					type: 'regex',
					regex: '/p/(\\d+)',
				},
			},
		],
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Artifact name',
	},
	{
		displayName: 'HTML',
		name: 'html',
		type: 'string',
		typeOptions: {
			rows: 6,
		},
		default: '',
		required: true,
		displayOptions,
		description: 'HTML source for the artifact',
	},
	{
		displayName: 'CSS',
		name: 'css',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '',
		displayOptions,
		description: 'Optional CSS source for the artifact',
	},
	{
		displayName: 'JavaScript',
		name: 'js',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '',
		displayOptions,
		description: 'Optional JavaScript source for the artifact',
	},
	{
		displayName: 'Public',
		name: 'public',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether artifact viewer access should be public',
	},
	{
		displayName: 'Metadata JSON',
		name: 'metadataJson',
		type: 'json',
		default: '',
		displayOptions,
		description: 'Optional metadata object. Public toggle overrides metadata.public.',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const userIdInput = this.getNodeParameter('userId', itemIndex);
	const postIdInput = this.getNodeParameter('postId', itemIndex);
	const name = this.getNodeParameter('name', itemIndex) as string;
	const html = this.getNodeParameter('html', itemIndex) as string;
	const css = this.getNodeParameter('css', itemIndex, '') as string;
	const js = this.getNodeParameter('js', itemIndex, '') as string;
	const isPublic = this.getNodeParameter('public', itemIndex, false) as boolean;
	const metadataInput = this.getNodeParameter('metadataJson', itemIndex, '');

	let userId: number;
	let postId: number;
	let metadata: IDataObject;

	try {
		userId = requirePositiveInteger(userIdInput, 'User ID');
		postId = resolvePostId(postIdInput);
		metadata = buildCreateMetadata(metadataInput, isPublic);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const payload: IDataObject = {
		user_id: userId,
		post_id: postId,
		name,
		html,
		css,
		js,
		metadata,
	};

	const response = await createAiArtifact.call(this, itemIndex, payload);
	const artifact = extractAiArtifact(response);

	return toExecutionData(itemIndex, artifact ?? response);
}

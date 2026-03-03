import {
	NodeConnectionTypes,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { categoryOperationHandlers, categoryOperations } from './actions/category';
import { dataExplorerOperationHandlers, dataExplorerOperations } from './actions/dataExplorer';
import {
	aiArtifactOperationHandlers,
	aiArtifactOperations,
} from './actions/aiArtifact';
import {
	aiArtifactStorageOperationHandlers,
	aiArtifactStorageOperations,
} from './actions/aiArtifactStorage';
import {
	personalMessageOperationHandlers,
	personalMessageOperations,
} from './actions/personalMessage';
import { postOperationHandlers, postOperations } from './actions/post';
import { topicOperationHandlers, topicOperations } from './actions/topic';
import { uploadOperationHandlers, uploadOperations } from './actions/upload';

const resourceOperationHandlers = {
	aiArtifact: aiArtifactOperationHandlers,
	aiArtifactStorage: aiArtifactStorageOperationHandlers,
	category: categoryOperationHandlers,
	dataExplorer: dataExplorerOperationHandlers,
	personalMessage: personalMessageOperationHandlers,
	post: postOperationHandlers,
	topic: topicOperationHandlers,
	upload: uploadOperationHandlers,
};

type GenericOperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

export class DiscourseExtended implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Discourse Extended',
		name: 'discourseExtended',
		icon: 'file:discourse.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Read and manage Discourse AI artifacts, categories, posts, topics, personal messages, uploads, and Data Explorer queries',
		defaults: {
			name: 'Discourse Extended',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'discourseExtendedApi',
				displayName: 'Discourse API (Discourse Extended)',
				required: true,
			},
			{
				name: 'elevenLabsApi',
				displayName: 'ElevenLabs API',
				required: false,
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['generateTtsAudio', 'generateTtsAudioWithSpacesUpload'],
					},
				},
			},
			{
				name: 'digitalOceanSpacesApi',
				displayName: 'DigitalOcean Spaces API',
				required: false,
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['generateTtsAudioWithSpacesUpload'],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'AI Artifact',
						value: 'aiArtifact',
					},
					{
						name: 'AI Artifact Storage',
						value: 'aiArtifactStorage',
					},
					{
						name: 'Category',
						value: 'category',
					},
					{
						name: 'Data Explorer',
						value: 'dataExplorer',
					},
					{
						name: 'Personal Message',
						value: 'personalMessage',
					},
					{
						name: 'Post',
						value: 'post',
					},
					{
						name: 'Topic',
						value: 'topic',
					},
					{
						name: 'Upload',
						value: 'upload',
					},
				],
				default: 'topic',
			},
			...aiArtifactOperations,
			...aiArtifactStorageOperations,
			...categoryOperations,
			...dataExplorerOperations,
			...personalMessageOperations,
			...postOperations,
			...topicOperations,
			...uploadOperations,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				const handlersByResource =
					resourceOperationHandlers[resource as keyof typeof resourceOperationHandlers];
				if (!handlersByResource) {
					throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`, {
						itemIndex,
					});
				}

				const handler = handlersByResource[
					operation as keyof typeof handlersByResource
				] as GenericOperationHandler | undefined;
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation for resource "${resource}": ${operation}`,
						{
							itemIndex,
						},
					);
				}

				const results = await handler.call(this, itemIndex);
				returnData.push(...results);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw error;
			}
		}

		return [returnData];
	}
}

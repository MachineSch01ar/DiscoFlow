import {
	NodeConnectionTypes,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { topicOperationHandlers, topicOperations } from './actions/topic';
import { uploadOperationHandlers, uploadOperations } from './actions/upload';

const resourceOperationHandlers = {
	topic: topicOperationHandlers,
	upload: uploadOperationHandlers,
};

export class Discourse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Discourse Extended',
		name: 'discourseExtended',
		icon: 'file:discourse.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and manage Discourse topics and uploads',
		defaults: {
			name: 'Discourse Extended',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'discourseApi',
				required: true,
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

				const handler = handlersByResource[operation as keyof typeof handlersByResource];
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

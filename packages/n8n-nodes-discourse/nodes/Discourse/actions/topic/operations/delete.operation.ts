import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getTopicId, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';

const displayOptions = {
	show: {
		resource: ['topic'],
		operation: ['delete'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Topic ID or URL',
		name: 'topicId',
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
				placeholder: 'https://forum.example.com/t/topic-slug/123',
				extractValue: {
					type: 'regex',
					regex: '/t/(?:[^/]+/)?(\\d+)',
				},
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const topicIdInput = this.getNodeParameter('topicId', itemIndex);
	let topicId: number;
	try {
		topicId = getTopicId(topicIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	await discourseApiRequest.call(this, itemIndex, 'DELETE', `/t/${topicId}.json`);

	return toExecutionData(itemIndex, { deleted: true });
}

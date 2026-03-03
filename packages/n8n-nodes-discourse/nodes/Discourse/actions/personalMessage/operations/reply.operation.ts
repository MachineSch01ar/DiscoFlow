import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getTopicId, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';

const displayOptions = {
	show: {
		resource: ['personalMessage'],
		operation: ['reply'],
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
	{
		displayName: 'Raw',
		name: 'raw',
		type: 'string',
		typeOptions: {
			rows: 6,
		},
		default: '',
		required: true,
		displayOptions,
		description: 'Raw post body for the reply',
	},
	{
		displayName: 'Reply To Post Number',
		name: 'replyToPostNumber',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 0,
		displayOptions,
		description: 'Optional post number to reply to inside the personal message topic',
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

	const raw = (this.getNodeParameter('raw', itemIndex) as string).trim();
	const replyToPostNumber = this.getNodeParameter('replyToPostNumber', itemIndex, 0) as number;

	if (!raw) {
		throw new NodeOperationError(this.getNode(), 'Raw is required.', { itemIndex });
	}

	const body: IDataObject = {
		topic_id: topicId,
		raw,
	};

	if (replyToPostNumber > 0) {
		body.reply_to_post_number = replyToPostNumber;
	}

	const response = await discourseApiRequest.call(this, itemIndex, 'POST', '/posts.json', {}, body);

	return toExecutionData(itemIndex, response);
}

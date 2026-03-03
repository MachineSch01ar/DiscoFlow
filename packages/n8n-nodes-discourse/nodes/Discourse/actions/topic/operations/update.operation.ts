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
		resource: ['topic'],
		operation: ['update'],
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
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		default: {},
		displayOptions,
		placeholder: 'Add Field',
		options: [
			{
				displayName: 'Category ID',
				name: 'categoryId',
				type: 'number',
				default: 0,
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
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

	const updateFields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;

	const body: IDataObject = {};
	const topic: IDataObject = {};

	if (updateFields.title) {
		topic.title = updateFields.title;
	}

	const categoryId = Number(updateFields.categoryId ?? 0);
	if (categoryId > 0) {
		topic.category_id = categoryId;
	}

	if (Object.keys(topic).length > 0) {
		body.topic = topic;
	}

	if (Object.keys(body).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Provide at least one update field.', {
			itemIndex,
		});
	}

	const response = await discourseApiRequest.call(this, itemIndex, 'PUT', `/t/-/${topicId}.json`, {}, body);

	return toExecutionData(itemIndex, response);
}

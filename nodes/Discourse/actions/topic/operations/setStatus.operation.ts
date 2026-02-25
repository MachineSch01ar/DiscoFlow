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
		operation: ['setStatus'],
	},
};

const pinDisplayOptions = {
	show: {
		resource: ['topic'],
		operation: ['setStatus'],
		status: ['pinned', 'pinned_globally'],
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
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'closed',
		displayOptions,
		options: [
			{
				name: 'Archived',
				value: 'archived',
			},
			{
				name: 'Closed',
				value: 'closed',
			},
			{
				name: 'Pinned',
				value: 'pinned',
			},
			{
				name: 'Pinned Globally',
				value: 'pinned_globally',
			},
			{
				name: 'Visible',
				value: 'visible',
			},
		],
	},
	{
		displayName: 'Enabled',
		name: 'enabled',
		type: 'boolean',
		default: true,
		displayOptions,
		description: 'Whether to enable or disable the selected status',
	},
	{
		displayName: 'Until',
		name: 'until',
		type: 'dateTime',
		default: '',
		displayOptions: pinDisplayOptions,
		description: 'Optional timestamp for pinned statuses',
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

	const status = this.getNodeParameter('status', itemIndex) as string;
	const enabled = this.getNodeParameter('enabled', itemIndex) as boolean;
	const until = this.getNodeParameter('until', itemIndex, '') as string;

	const body: IDataObject = {
		status,
		enabled: enabled ? 'true' : 'false',
	};

	if (until) {
		body.until = until;
	}

	const response = await discourseApiRequest.call(
		this,
		itemIndex,
		'PUT',
		`/t/${topicId}/status.json`,
		{},
		body,
	);

	return toExecutionData(itemIndex, response);
}

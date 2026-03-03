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
		operation: ['inviteGroup'],
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
		displayName: 'Group Name',
		name: 'groupName',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Group name to invite into the personal message topic',
	},
	{
		displayName: 'Notify Group',
		name: 'shouldNotify',
		type: 'boolean',
		default: true,
		displayOptions,
		description: 'Whether to notify the invited group',
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

	const groupName = (this.getNodeParameter('groupName', itemIndex) as string).trim();
	const shouldNotify = this.getNodeParameter('shouldNotify', itemIndex, true) as boolean;

	if (!groupName) {
		throw new NodeOperationError(this.getNode(), 'Group Name is required.', { itemIndex });
	}

	const body: IDataObject = {
		group: groupName,
		should_notify: shouldNotify ? 'true' : 'false',
	};

	const response = await discourseApiRequest.call(
		this,
		itemIndex,
		'POST',
		`/t/${topicId}/invite-group.json`,
		{},
		body,
	);

	return toExecutionData(itemIndex, response);
}

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
		operation: ['addParticipant'],
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
		displayName: 'Participant Username',
		name: 'participantUsername',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Username to invite into the personal message topic',
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

	const participantUsername = (this.getNodeParameter('participantUsername', itemIndex) as string).trim();
	if (!participantUsername) {
		throw new NodeOperationError(this.getNode(), 'Participant Username is required.', { itemIndex });
	}

	const body: IDataObject = {
		username: participantUsername,
	};

	const response = await discourseApiRequest.call(
		this,
		itemIndex,
		'POST',
		`/t/${topicId}/invite.json`,
		{},
		body,
	);

	return toExecutionData(itemIndex, response);
}

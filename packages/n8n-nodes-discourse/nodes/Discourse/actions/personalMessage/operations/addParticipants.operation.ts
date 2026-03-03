import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getTopicId, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { parseCsvValues } from '../helpers';

const displayOptions = {
	show: {
		resource: ['personalMessage'],
		operation: ['addParticipants'],
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
		displayName: 'Participant Usernames',
		name: 'participantUsernames',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Comma-separated usernames to invite into the personal message topic',
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

	const participantUsernamesInput = this.getNodeParameter('participantUsernames', itemIndex) as string;
	const usernames = parseCsvValues(participantUsernamesInput);

	if (usernames.length === 0) {
		throw new NodeOperationError(this.getNode(), 'Provide at least one participant username.', {
			itemIndex,
		});
	}

	const results: unknown[] = [];
	for (const username of usernames) {
		const response = await discourseApiRequest.call(
			this,
			itemIndex,
			'POST',
			`/t/${topicId}/invite.json`,
			{},
			{ username },
		);

		if (response && typeof response === 'object' && !Array.isArray(response)) {
			results.push({
				username,
				...(response as IDataObject),
			});
		} else {
			results.push({
				username,
				response,
			});
		}
	}

	return toExecutionData(itemIndex, results);
}

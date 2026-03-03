import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { buildCreatePrivateMessageBody, parseCsvValues } from '../helpers';

const displayOptions = {
	show: {
		resource: ['personalMessage'],
		operation: ['create'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Title for the private message topic',
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
		description: 'Raw post body for the private message',
	},
	{
		displayName: 'Recipient Usernames',
		name: 'recipientUsernames',
		type: 'string',
		default: '',
		displayOptions,
		description: 'Comma-separated usernames to include in the private message',
	},
	{
		displayName: 'Recipient Group Names',
		name: 'recipientGroupNames',
		type: 'string',
		default: '',
		displayOptions,
		description: 'Optional comma-separated group names to include in the private message',
	},
	{
		displayName: 'Tags',
		name: 'tags',
		type: 'string',
		default: '',
		displayOptions,
		description: 'Optional comma-separated tags for the private message topic',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const title = (this.getNodeParameter('title', itemIndex) as string).trim();
	const raw = (this.getNodeParameter('raw', itemIndex) as string).trim();
	const recipientUsernamesInput = this.getNodeParameter('recipientUsernames', itemIndex, '') as string;
	const recipientGroupNamesInput = this.getNodeParameter('recipientGroupNames', itemIndex, '') as string;
	const tagsInput = this.getNodeParameter('tags', itemIndex, '') as string;

	if (!title) {
		throw new NodeOperationError(this.getNode(), 'Title is required.', { itemIndex });
	}

	if (!raw) {
		throw new NodeOperationError(this.getNode(), 'Raw is required.', { itemIndex });
	}

	const recipientUsernames = parseCsvValues(recipientUsernamesInput);
	const recipientGroupNames = parseCsvValues(recipientGroupNamesInput);
	const tags = parseCsvValues(tagsInput);

	if (recipientUsernames.length === 0 && recipientGroupNames.length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'Provide at least one recipient username or recipient group name.',
			{ itemIndex },
		);
	}

	const body = buildCreatePrivateMessageBody({
		title,
		raw,
		recipientUsernames,
		recipientGroupNames,
		tags,
	});

	const response = await discourseApiRequest.call(this, itemIndex, 'POST', '/posts.json', {}, body);

	return toExecutionData(itemIndex, response);
}

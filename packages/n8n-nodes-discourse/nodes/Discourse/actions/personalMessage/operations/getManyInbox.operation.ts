import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getTopicsFromResponse, simplifyPrivateMessageTopic, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';

const displayOptions = {
	show: {
		resource: ['personalMessage'],
		operation: ['getManyInbox'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Mailbox Username',
		name: 'mailboxUsername',
		type: 'string',
		default: '',
		displayOptions,
		description: 'Username whose inbox to list. Defaults to API Username when empty.',
	},
	{
		displayName: 'Page',
		name: 'page',
		type: 'number',
		default: 0,
		typeOptions: {
			minValue: 0,
		},
		displayOptions,
		description: 'Optional 0-based page index',
	},
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		displayOptions,
		description: 'Whether to return a simplified version of the response instead of the raw data',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const mailboxUsernameInput = (this.getNodeParameter('mailboxUsername', itemIndex, '') as string).trim();
	const page = this.getNodeParameter('page', itemIndex, 0) as number;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const credentials = await this.getCredentials('discourseExtendedApi', itemIndex);
	const apiUsername = String(credentials.apiUsername ?? '').trim();
	const mailboxUsername = mailboxUsernameInput || apiUsername;

	if (!mailboxUsername) {
		throw new NodeOperationError(this.getNode(), 'Mailbox Username or API Username is required.', {
			itemIndex,
		});
	}

	const qs: IDataObject = {};
	if (page > 0) {
		qs.page = page;
	}

	const response = await discourseApiRequest.call(
		this,
		itemIndex,
		'GET',
		`/topics/private-messages/${encodeURIComponent(mailboxUsername)}.json`,
		qs,
	);

	if (simplify) {
		const topics = getTopicsFromResponse(response);
		return toExecutionData(itemIndex, topics.map((topic) => simplifyPrivateMessageTopic(topic)));
	}

	return toExecutionData(itemIndex, response);
}

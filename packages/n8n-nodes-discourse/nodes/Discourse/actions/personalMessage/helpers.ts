import type { IDataObject } from 'n8n-workflow';

export function parseCsvValues(value: string): string[] {
	return value
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export function buildCreatePrivateMessageBody(input: {
	title: string;
	raw: string;
	recipientUsernames: string[];
	recipientGroupNames: string[];
	tags: string[];
}): IDataObject {
	const body: IDataObject = {
		archetype: 'private_message',
		title: input.title,
		raw: input.raw,
	};

	if (input.recipientUsernames.length > 0) {
		const recipients = input.recipientUsernames.join(',');
		body.target_usernames = recipients;
		body.target_recipients = recipients;
	}

	if (input.recipientGroupNames.length > 0) {
		body.target_group_names = input.recipientGroupNames.join(',');
	}

	if (input.tags.length > 0) {
		body.tags = input.tags;
	}

	return body;
}

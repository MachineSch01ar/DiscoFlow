import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import {
	description as addParticipantDescription,
	execute as addParticipantExecute,
} from './operations/addParticipant.operation';
import {
	description as addParticipantsDescription,
	execute as addParticipantsExecute,
} from './operations/addParticipants.operation';
import { description as createDescription, execute as createExecute } from './operations/create.operation';
import {
	description as getManyInboxDescription,
	execute as getManyInboxExecute,
} from './operations/getManyInbox.operation';
import {
	description as getManySentDescription,
	execute as getManySentExecute,
} from './operations/getManySent.operation';
import {
	description as inviteGroupDescription,
	execute as inviteGroupExecute,
} from './operations/inviteGroup.operation';
import {
	description as removeParticipantDescription,
	execute as removeParticipantExecute,
} from './operations/removeParticipant.operation';
import { description as replyDescription, execute as replyExecute } from './operations/reply.operation';

const showOnlyForPersonalMessages = {
	resource: ['personalMessage'],
};

export type PersonalMessageOperation =
	| 'addParticipant'
	| 'addParticipants'
	| 'create'
	| 'getManyInbox'
	| 'getManySent'
	| 'inviteGroup'
	| 'removeParticipant'
	| 'reply';

export type PersonalMessageOperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

export const personalMessageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForPersonalMessages,
		},
		options: [
			{
				name: 'Add Participant',
				value: 'addParticipant',
				action: 'Add a participant to a personal message',
			},
			{
				name: 'Add Participants (Batch)',
				value: 'addParticipants',
				action: 'Add participants to a personal message',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a personal message',
			},
			{
				name: 'Get Many (Inbox)',
				value: 'getManyInbox',
				action: 'Get many personal messages from inbox',
			},
			{
				name: 'Get Many (Sent)',
				value: 'getManySent',
				action: 'Get many sent personal messages',
			},
			{
				name: 'Invite Group',
				value: 'inviteGroup',
				action: 'Invite a group to a personal message',
			},
			{
				name: 'Remove Participant',
				value: 'removeParticipant',
				action: 'Remove a participant from a personal message',
			},
			{
				name: 'Reply',
				value: 'reply',
				action: 'Reply to a personal message',
			},
		],
		default: 'getManyInbox',
	},
	...createDescription,
	...replyDescription,
	...getManyInboxDescription,
	...getManySentDescription,
	...addParticipantDescription,
	...addParticipantsDescription,
	...removeParticipantDescription,
	...inviteGroupDescription,
];

export const personalMessageOperationHandlers: Record<PersonalMessageOperation, PersonalMessageOperationHandler> =
	{
		addParticipant: addParticipantExecute,
		addParticipants: addParticipantsExecute,
		create: createExecute,
		getManyInbox: getManyInboxExecute,
		getManySent: getManySentExecute,
		inviteGroup: inviteGroupExecute,
		removeParticipant: removeParticipantExecute,
		reply: replyExecute,
	};

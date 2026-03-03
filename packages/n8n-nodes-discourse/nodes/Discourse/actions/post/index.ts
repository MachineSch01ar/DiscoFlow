import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { description as createDescription, execute as createExecute } from './operations/create.operation';
import { description as deleteDescription, execute as deleteExecute } from './operations/delete.operation';
import { description as getDescription, execute as getExecute } from './operations/get.operation';
import {
	description as getManyAllDescription,
	execute as getManyAllExecute,
} from './operations/getManyAll.operation';
import {
	description as getManyTopicDescription,
	execute as getManyTopicExecute,
} from './operations/getManyTopic.operation';
import {
	description as getManyUserDescription,
	execute as getManyUserExecute,
} from './operations/getManyUser.operation';
import { description as updateDescription, execute as updateExecute } from './operations/update.operation';
import { description as likeDescription, execute as likeExecute } from './operations/like.operation';
import { description as unlikeDescription, execute as unlikeExecute } from './operations/unlike.operation';
import { description as bookmarkDescription, execute as bookmarkExecute } from './operations/bookmark.operation';
import {
	description as unbookmarkDescription,
	execute as unbookmarkExecute,
} from './operations/unbookmark.operation';
import {
	description as getRevisionLatestDescription,
	execute as getRevisionLatestExecute,
} from './operations/getRevisionLatest.operation';
import {
	description as getRevisionVersionDescription,
	execute as getRevisionVersionExecute,
} from './operations/getRevisionVersion.operation';
import { description as recoverDescription, execute as recoverExecute } from './operations/recover.operation';
import {
	description as prepareForTtsDescription,
	execute as prepareForTtsExecute,
} from './operations/prepareForTts.operation';
import {
	description as generateTtsAudioDescription,
	execute as generateTtsAudioExecute,
} from './operations/generateTtsAudio.operation';

const showOnlyForPosts = {
	resource: ['post'],
};

export type PostOperation =
	| 'bookmark'
	| 'create'
	| 'delete'
	| 'get'
	| 'getManyAll'
	| 'getManyTopic'
	| 'getManyUser'
	| 'getRevisionLatest'
	| 'getRevisionVersion'
	| 'generateTtsAudio'
	| 'generateTtsAudioWithSpacesUpload'
	| 'like'
	| 'prepareForTts'
	| 'recover'
	| 'unbookmark'
	| 'unlike'
	| 'update';

export type PostOperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

export const postOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForPosts,
		},
		options: [
			{
				name: 'Bookmark',
				value: 'bookmark',
				action: 'Bookmark a post',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a post reply',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a post',
			},
			{
				name: 'Generate TTS Audio',
				value: 'generateTtsAudio',
				action: 'Generate stitched TTS audio',
			},
			{
				name: 'Generate TTS Audio + Spaces Upload',
				value: 'generateTtsAudioWithSpacesUpload',
				action: 'Generate stitched TTS audio and upload to spaces',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a post',
			},
			{
				name: 'Get Many (All Posts)',
				value: 'getManyAll',
				action: 'Get many posts from global post feed',
			},
			{
				name: 'Get Many (Topic)',
				value: 'getManyTopic',
				action: 'Get many posts from a topic',
			},
			{
				name: 'Get Many (User)',
				value: 'getManyUser',
				action: 'Get many posts from a user activity feed',
			},
			{
				name: 'Get Revision (Latest)',
				value: 'getRevisionLatest',
				action: 'Get latest revision of a post',
			},
			{
				name: 'Get Revision (Version)',
				value: 'getRevisionVersion',
				action: 'Get a specific revision of a post',
			},
			{
				name: 'Like',
				value: 'like',
				action: 'Like a post',
			},
			{
				name: 'Prepare for TTS',
				value: 'prepareForTts',
				action: 'Prepare post text for TTS',
			},
			{
				name: 'Recover',
				value: 'recover',
				action: 'Recover a deleted post',
			},
			{
				name: 'Unbookmark',
				value: 'unbookmark',
				action: 'Remove bookmark from a post',
			},
			{
				name: 'Unlike',
				value: 'unlike',
				action: 'Remove like from a post',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a post',
			},
		],
		default: 'getManyTopic',
	},
	...bookmarkDescription,
	...createDescription,
	...deleteDescription,
	...getDescription,
	...getManyAllDescription,
	...getManyTopicDescription,
	...getManyUserDescription,
	...getRevisionLatestDescription,
	...getRevisionVersionDescription,
	...generateTtsAudioDescription,
	...likeDescription,
	...prepareForTtsDescription,
	...recoverDescription,
	...unbookmarkDescription,
	...unlikeDescription,
	...updateDescription,
];

export const postOperationHandlers: Record<PostOperation, PostOperationHandler> = {
	bookmark: bookmarkExecute,
	create: createExecute,
	delete: deleteExecute,
	get: getExecute,
	getManyAll: getManyAllExecute,
	getManyTopic: getManyTopicExecute,
	getManyUser: getManyUserExecute,
	getRevisionLatest: getRevisionLatestExecute,
	getRevisionVersion: getRevisionVersionExecute,
	generateTtsAudio: generateTtsAudioExecute,
	generateTtsAudioWithSpacesUpload: generateTtsAudioExecute,
	like: likeExecute,
	prepareForTts: prepareForTtsExecute,
	recover: recoverExecute,
	unbookmark: unbookmarkExecute,
	unlike: unlikeExecute,
	update: updateExecute,
};

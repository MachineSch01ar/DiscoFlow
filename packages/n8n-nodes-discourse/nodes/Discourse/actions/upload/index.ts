import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { description as createDescription, execute as createExecute } from './operations/create.operation';
import {
	description as createFromSourceUrlDescription,
	execute as createFromSourceUrlExecute,
} from './operations/createFromSourceUrl.operation';
import {
	description as uploadToObjectStorageDescription,
	execute as uploadToObjectStorageExecute,
} from './operations/uploadToObjectStorage.operation';

const showOnlyForUploads = {
	resource: ['upload'],
};

export type UploadOperation = 'create' | 'createFromSourceUrl' | 'uploadToObjectStorage';

export type UploadOperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

export const uploadOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForUploads,
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an upload',
			},
			{
				name: 'Create From Source URL',
				value: 'createFromSourceUrl',
				action: 'Create an upload from source URL',
			},
			{
				name: 'Upload to Object Storage',
				value: 'uploadToObjectStorage',
				action: 'Upload data to object storage',
			},
		],
		default: 'create',
	},
	...createDescription,
	...createFromSourceUrlDescription,
	...uploadToObjectStorageDescription,
];

export const uploadOperationHandlers: Record<UploadOperation, UploadOperationHandler> = {
	create: createExecute,
	createFromSourceUrl: createFromSourceUrlExecute,
	uploadToObjectStorage: uploadToObjectStorageExecute,
};

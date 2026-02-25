import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeProperties,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { simplifyUpload, toExecutionData } from '../../utils';

const displayOptions = {
	show: {
		resource: ['upload'],
		operation: ['create'],
	},
};

const avatarDisplayOptions = {
	show: {
		resource: ['upload'],
		operation: ['create'],
		type: ['avatar'],
	},
};

function getUploadFilename(binaryData: IBinaryData): string {
	const fileName = binaryData.fileName ?? '';
	if (fileName.trim()) {
		return fileName;
	}

	return 'upload.bin';
}

export const description: INodeProperties[] = [
	{
		displayName: 'Input Data Field Name',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions,
		description: 'Name of the incoming field containing the file to upload',
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		default: 'composer',
		displayOptions,
		options: [
			{
				name: 'Avatar',
				value: 'avatar',
			},
			{
				name: 'Card Background',
				value: 'card_background',
			},
			{
				name: 'Composer',
				value: 'composer',
			},
			{
				name: 'Custom Emoji',
				value: 'custom_emoji',
			},
			{
				name: 'Profile Background',
				value: 'profile_background',
			},
		],
		description: 'Discourse upload type',
	},
	{
		displayName: 'Synchronous',
		name: 'synchronous',
		type: 'boolean',
		default: true,
		displayOptions,
		description: 'Whether to wait for upload processing and return the upload details',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'number',
		default: 0,
		displayOptions: avatarDisplayOptions,
		typeOptions: {
			minValue: 1,
		},
		description: 'Required when type is Avatar',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		displayOptions,
		placeholder: 'Add Field',
		options: [
			{
				displayName: 'For Private Message',
				name: 'forPrivateMessage',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'For Site Setting',
				name: 'forSiteSetting',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Pasted',
				name: 'pasted',
				type: 'boolean',
				default: false,
			},
		],
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
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
	const type = this.getNodeParameter('type', itemIndex) as string;
	const synchronous = this.getNodeParameter('synchronous', itemIndex, true) as boolean;
	const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
	const uploadBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	const fileName = getUploadFilename(binaryData);
	const mimeType = binaryData.mimeType ?? 'application/octet-stream';

	const credentials = await this.getCredentials('discourseApi', itemIndex);
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');
	if (!baseUrl) {
		throw new NodeOperationError(this.getNode(), 'Base URL is required in Discourse credentials', {
			itemIndex,
		});
	}

	const formData: IDataObject = {
		type,
		synchronous,
		file: {
			value: uploadBuffer,
			options: {
				filename: fileName,
				contentType: mimeType,
			},
		},
	};

	if (type === 'avatar') {
		const userId = this.getNodeParameter('userId', itemIndex, 0) as number;
		if (userId <= 0) {
			throw new NodeOperationError(this.getNode(), 'User ID is required when type is Avatar', {
				itemIndex,
			});
		}

		formData.user_id = userId;
	}

	if (additionalFields.pasted !== undefined) {
		formData.pasted = additionalFields.pasted;
	}

	if (additionalFields.forPrivateMessage !== undefined) {
		formData.for_private_message = additionalFields.forPrivateMessage;
	}

	if (additionalFields.forSiteSetting !== undefined) {
		formData.for_site_setting = additionalFields.forSiteSetting;
	}

	const options: IHttpRequestOptions & { formData: IDataObject } = {
		method: 'POST',
		url: `${baseUrl}/uploads.json`,
		formData,
		json: true,
	};

	let response: unknown;
	try {
		response = await this.helpers.httpRequestWithAuthentication.call(this, 'discourseApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	if (simplify && response && typeof response === 'object' && !Array.isArray(response)) {
		return toExecutionData(itemIndex, simplifyUpload(response as IDataObject));
	}

	return toExecutionData(itemIndex, response);
}

import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeProperties,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { simplifyUpload, toExecutionData } from '../../utils';

declare const Buffer: {
	from: (data: unknown, byteOffset?: number, length?: number) => unknown;
	isBuffer: (value: unknown) => boolean;
};

const displayOptions = {
	show: {
		resource: ['upload'],
		operation: ['createFromSourceUrl'],
	},
};

const avatarDisplayOptions = {
	show: {
		resource: ['upload'],
		operation: ['createFromSourceUrl'],
		type: ['avatar'],
	},
};

function sanitizeFileName(fileName: string): string {
	return fileName.trim().replace(/[\\/]/g, '_');
}

function getFilenameFromUrl(sourceUrl: string): string | null {
	try {
		const withoutFragment = sourceUrl.split('#', 1)[0];
		const withoutQuery = withoutFragment.split('?', 1)[0];
		const protocolSplitIndex = withoutQuery.indexOf('://');
		const pathStart = protocolSplitIndex >= 0 ? withoutQuery.indexOf('/', protocolSplitIndex + 3) : 0;
		const path = pathStart >= 0 ? withoutQuery.slice(pathStart) : withoutQuery;
		const pathSegments = path.split('/').filter(Boolean);
		const lastSegment = pathSegments[pathSegments.length - 1] ?? '';
		if (!lastSegment) {
			return null;
		}

		const decoded = decodeURIComponent(lastSegment);
		const sanitized = sanitizeFileName(decoded);
		return sanitized || null;
	} catch {
		return null;
	}
}

function getHeaderValue(headers: IDataObject | undefined, headerName: string): string | null {
	if (!headers || typeof headers !== 'object') {
		return null;
	}

	const directValue = headers[headerName] ?? headers[headerName.toLowerCase()] ?? headers[headerName.toUpperCase()];
	if (typeof directValue === 'string') {
		return directValue;
	}

	if (Array.isArray(directValue) && typeof directValue[0] === 'string') {
		return directValue[0];
	}

	return null;
}

function toBinaryBody(body: unknown): unknown {
	if (Buffer.isBuffer(body)) {
		return body;
	}

	if (body instanceof ArrayBuffer) {
		return Buffer.from(body);
	}

	if (ArrayBuffer.isView(body)) {
		return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	}

	if (typeof body === 'string') {
		return Buffer.from(body);
	}

	throw new Error('Unable to parse source URL response body as binary data');
}

export const description: INodeProperties[] = [
	{
		displayName: 'Source URL',
		name: 'sourceUrl',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Presigned or publicly accessible URL for the source object',
	},
	{
		displayName: 'Original Filename',
		name: 'fileName',
		type: 'string',
		default: '',
		displayOptions,
		description: 'Optional override for filename sent to Discourse',
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
	const sourceUrl = this.getNodeParameter('sourceUrl', itemIndex) as string;
	const fileNameInput = this.getNodeParameter('fileName', itemIndex, '') as string;
	const type = this.getNodeParameter('type', itemIndex) as string;
	const synchronous = this.getNodeParameter('synchronous', itemIndex, true) as boolean;
	const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const sourceRequestOptions: IHttpRequestOptions = {
		method: 'GET',
		url: sourceUrl,
		encoding: 'arraybuffer',
		returnFullResponse: true,
	};

	let sourceResponse: unknown;
	try {
		sourceResponse = await this.helpers.httpRequest(sourceRequestOptions);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			itemIndex,
			message: 'Failed to fetch source URL. Ensure it is publicly accessible or presigned and unexpired.',
		});
	}

	if (!sourceResponse || typeof sourceResponse !== 'object' || Array.isArray(sourceResponse)) {
		throw new NodeOperationError(this.getNode(), 'Unexpected response while fetching source URL', {
			itemIndex,
		});
	}

	const sourceData = sourceResponse as IDataObject;
	let sourceBody: unknown;
	try {
		sourceBody = toBinaryBody(sourceData.body);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const sourceHeaders =
		sourceData.headers && typeof sourceData.headers === 'object' && !Array.isArray(sourceData.headers)
			? (sourceData.headers as IDataObject)
			: undefined;
	const sourceContentType = getHeaderValue(sourceHeaders, 'content-type');
	const mimeType = (sourceContentType ?? 'application/octet-stream').split(';', 1)[0];
	const fileName =
		sanitizeFileName(fileNameInput) || getFilenameFromUrl(sourceUrl) || 'upload.bin';

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
			value: sourceBody,
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

	const discourseRequestOptions: IHttpRequestOptions & { formData: IDataObject } = {
		method: 'POST',
		url: `${baseUrl}/uploads.json`,
		formData,
		json: true,
	};

	let discourseResponse: unknown;
	try {
		discourseResponse = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'discourseApi',
			discourseRequestOptions,
		);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	if (simplify && discourseResponse && typeof discourseResponse === 'object' && !Array.isArray(discourseResponse)) {
		return toExecutionData(itemIndex, simplifyUpload(discourseResponse as IDataObject));
	}

	return toExecutionData(itemIndex, discourseResponse);
}

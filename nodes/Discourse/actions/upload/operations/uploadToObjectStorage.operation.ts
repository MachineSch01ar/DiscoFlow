import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeProperties,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { toExecutionData } from '../../utils';

const displayOptions = {
	show: {
		resource: ['upload'],
		operation: ['uploadToObjectStorage'],
	},
};

function getUploadFilename(binaryData: IBinaryData): string {
	const fileName = binaryData.fileName ?? '';
	if (fileName.trim()) {
		return fileName;
	}

	return 'upload.bin';
}

function getStatusCode(response: unknown): number | null {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return null;
	}

	const data = response as IDataObject;
	const statusCode = data.statusCode;
	if (typeof statusCode === 'number') {
		return statusCode;
	}

	return null;
}

function getEtag(response: unknown): string | null {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return null;
	}

	const data = response as IDataObject;
	const headers =
		data.headers && typeof data.headers === 'object' && !Array.isArray(data.headers)
			? (data.headers as IDataObject)
			: undefined;
	if (!headers) {
		return null;
	}

	const directValue = headers.etag ?? headers.ETag ?? headers.ETAG;
	if (typeof directValue === 'string') {
		return directValue;
	}

	return null;
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
		displayName: 'Presigned PUT URL',
		name: 'presignedUrl',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Presigned URL for object storage PUT upload',
	},
	{
		displayName: 'Content Type',
		name: 'contentType',
		type: 'string',
		default: '',
		displayOptions,
		description: 'Optional Content-Type override for the upload',
	},
	{
		displayName: 'Return Metadata',
		name: 'returnMetadata',
		type: 'boolean',
		default: true,
		displayOptions,
		description: 'Whether to include upload metadata in the output',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
	const presignedUrl = this.getNodeParameter('presignedUrl', itemIndex) as string;
	const contentTypeInput = this.getNodeParameter('contentType', itemIndex, '') as string;
	const returnMetadata = this.getNodeParameter('returnMetadata', itemIndex, true) as boolean;

	const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
	const uploadBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	const fileName = getUploadFilename(binaryData);
	const mimeType = contentTypeInput.trim() || binaryData.mimeType || 'application/octet-stream';

	const requestOptions: IHttpRequestOptions = {
		method: 'PUT',
		url: presignedUrl,
		headers: {
			'Content-Type': mimeType,
		},
		body: uploadBuffer,
		returnFullResponse: true,
	};

	let uploadResponse: unknown;
	try {
		uploadResponse = await this.helpers.httpRequest(requestOptions);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			itemIndex,
			message:
				'Object storage upload failed. Ensure presigned URL is valid, uses PUT, and has not expired.',
		});
	}

	if (!returnMetadata) {
		return toExecutionData(itemIndex, { uploaded: true });
	}

	const statusCode = getStatusCode(uploadResponse);
	const etag = getEtag(uploadResponse);
	const result: IDataObject = {
		uploaded: true,
		url: presignedUrl,
		fileName,
		mimeType,
		size: uploadBuffer.length,
	};

	if (statusCode !== null) {
		result.statusCode = statusCode;
	}

	if (etag) {
		result.etag = etag;
	}

	return toExecutionData(itemIndex, result);
}

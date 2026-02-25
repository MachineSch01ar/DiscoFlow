import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

const RETRIABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;

function getStatusCode(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') {
		return undefined;
	}

	const data = error as IDataObject;
	const directCode = Number(data.statusCode ?? data.status);
	if (!Number.isNaN(directCode) && directCode > 0) {
		return directCode;
	}

	const response = data.response as IDataObject | undefined;
	if (!response || typeof response !== 'object') {
		return undefined;
	}

	const responseCode = Number((response.statusCode as number | undefined) ?? (response.status as number | undefined));
	if (!Number.isNaN(responseCode) && responseCode > 0) {
		return responseCode;
	}

	return undefined;
}

function compactObject(data: IDataObject): IDataObject {
	return Object.entries(data).reduce((acc, [key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			acc[key] = value;
		}
		return acc;
	}, {} as IDataObject);
}

export async function discourseApiRequest(
	this: IExecuteFunctions,
	itemIndex: number,
	method: IHttpRequestMethods,
	path: string,
	qs: IDataObject = {},
	body?: IDataObject,
): Promise<unknown> {
	const credentials = await this.getCredentials('discourseApi', itemIndex);
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		json: true,
	};

	const query = compactObject(qs);
	if (Object.keys(query).length > 0) {
		options.qs = query;
	}

	if (body) {
		const bodyData = compactObject(body);
		if (Object.keys(bodyData).length > 0) {
			options.body = bodyData;
		}
	}

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			return await this.helpers.httpRequestWithAuthentication.call(this, 'discourseApi', options);
		} catch (error) {
			const statusCode = getStatusCode(error);
			const isRetriable = statusCode !== undefined && RETRIABLE_STATUS_CODES.has(statusCode);
			if (!isRetriable || attempt === MAX_RETRIES) {
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
			}
		}
	}

	return {};
}

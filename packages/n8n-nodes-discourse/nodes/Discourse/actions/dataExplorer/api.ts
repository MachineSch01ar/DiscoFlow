import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

const API_BASE = '/api/query';
const PUBLIC_RUN_BASE = '/data-explorer/queries';
const ADMIN_BASE = '/admin/plugins/discourse-data-explorer/queries';
const LEGACY_ADMIN_BASE = '/admin/plugins/explorer/queries';
const FALLBACK_STATUS_CODES = new Set([404, 405]);

type RequestAttempt = {
	method: IHttpRequestMethods;
	path: string;
	qs?: IDataObject;
	body?: IDataObject;
};

type QueryWritePayload = {
	name?: string;
	sql?: string;
	description?: string;
	params?: IDataObject;
};

function compactObject(data: IDataObject): IDataObject {
	return Object.entries(data).reduce((acc, [key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			acc[key] = value;
		}
		return acc;
	}, {} as IDataObject);
}

function isDataObject(value: unknown): value is IDataObject {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseNumericCode(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return Math.trunc(value);
	}

	if (typeof value === 'string') {
		const digits = value.match(/\d+/)?.[0];
		if (!digits) {
			return undefined;
		}

		const parsed = Number(digits);
		if (Number.isFinite(parsed)) {
			return Math.trunc(parsed);
		}
	}

	return undefined;
}

function getStatusCode(error: unknown): number | undefined {
	if (!isDataObject(error)) {
		return undefined;
	}

	const directCode =
		parseNumericCode(error.statusCode) ??
		parseNumericCode(error.status) ??
		parseNumericCode(error.httpCode);
	if (directCode !== undefined) {
		return directCode;
	}

	const response = error.response;
	if (isDataObject(response)) {
		const responseCode = parseNumericCode(response.statusCode) ?? parseNumericCode(response.status);
		if (responseCode !== undefined) {
			return responseCode;
		}
	}

	const cause = error.cause;
	if (isDataObject(cause)) {
		const causeCode =
			parseNumericCode(cause.statusCode) ??
			parseNumericCode(cause.status) ??
			parseNumericCode(cause.httpCode);
		if (causeCode !== undefined) {
			return causeCode;
		}
	}

	return undefined;
}

function toJsonObject(error: unknown): JsonObject {
	if (error && typeof error === 'object') {
		return error as JsonObject;
	}

	return { message: String(error) };
}

async function requestAttempt(
	this: IExecuteFunctions,
	itemIndex: number,
	attempt: RequestAttempt,
): Promise<unknown> {
	const credentials = await this.getCredentials('discourseExtendedApi', itemIndex);
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method: attempt.method,
		url: `${baseUrl}${attempt.path}`,
		json: true,
	};

	if (attempt.qs) {
		const query = compactObject(attempt.qs);
		if (Object.keys(query).length > 0) {
			options.qs = query;
		}
	}

	if (attempt.body) {
		const body = compactObject(attempt.body);
		if (Object.keys(body).length > 0) {
			options.body = body;
		}
	}

	return this.helpers.httpRequestWithAuthentication.call(this, 'discourseExtendedApi', options);
}

async function requestWithFallback(
	this: IExecuteFunctions,
	itemIndex: number,
	attempts: RequestAttempt[],
): Promise<unknown> {
	let lastError: unknown;

	for (let index = 0; index < attempts.length; index++) {
		try {
			return await requestAttempt.call(this, itemIndex, attempts[index]);
		} catch (error) {
			lastError = error;
			const statusCode = getStatusCode(error);
			const hasFallback = index < attempts.length - 1;
			if (hasFallback && statusCode !== undefined && FALLBACK_STATUS_CODES.has(statusCode)) {
				continue;
			}

			throw new NodeApiError(this.getNode(), toJsonObject(error), { itemIndex });
		}
	}

	throw new NodeApiError(this.getNode(), toJsonObject(lastError), { itemIndex });
}

function toApiWritePayload(payload: QueryWritePayload): IDataObject {
	const result: IDataObject = {};

	if (payload.name !== undefined) {
		result.name = payload.name;
	}

	if (payload.sql !== undefined) {
		result.sql = payload.sql;
	}

	if (payload.description !== undefined) {
		result.description = payload.description;
	}

	if (payload.params !== undefined) {
		result.params = payload.params;
	}

	return result;
}

function toAdminWritePayload(payload: QueryWritePayload): IDataObject {
	const query: IDataObject = {};

	if (payload.name !== undefined) {
		query.name = payload.name;
	}

	if (payload.sql !== undefined) {
		query.sql = payload.sql;
	}

	if (payload.description !== undefined) {
		query.description = payload.description;
	}

	if (payload.params !== undefined) {
		query.params = JSON.stringify(payload.params);
	}

	return { query };
}

function serializeParams(params?: IDataObject): string | undefined {
	if (!params) {
		return undefined;
	}

	return JSON.stringify(params);
}

export function extractDataExplorerQueries(response: unknown): IDataObject[] {
	if (Array.isArray(response)) {
		return response.filter(isDataObject);
	}

	if (!isDataObject(response)) {
		return [];
	}

	const fromQueries = response.queries;
	if (Array.isArray(fromQueries)) {
		return fromQueries.filter(isDataObject);
	}

	const fromData = response.data;
	if (Array.isArray(fromData)) {
		return fromData.filter(isDataObject);
	}

	const singleQuery = response.query;
	if (isDataObject(singleQuery)) {
		return [singleQuery];
	}

	return [];
}

export function extractDataExplorerQuery(response: unknown): IDataObject | null {
	if (!isDataObject(response)) {
		return null;
	}

	if (isDataObject(response.query)) {
		return response.query;
	}

	if (isDataObject(response.data)) {
		return response.data;
	}

	if (response.id !== undefined && response.name !== undefined) {
		return response;
	}

	return null;
}

export function extractDataExplorerRunResult(response: unknown): IDataObject {
	if (!isDataObject(response)) {
		return {
			columns: [],
			rows: [],
		};
	}

	const nestedResult = isDataObject(response.result) ? response.result : undefined;
	const columns = Array.isArray(response.columns)
		? response.columns
		: Array.isArray(nestedResult?.columns)
			? nestedResult.columns
			: [];
	const rows = Array.isArray(response.rows)
		? response.rows
		: Array.isArray(nestedResult?.rows)
			? nestedResult.rows
			: [];

	return {
		columns,
		rows,
	};
}

export async function listQueries(this: IExecuteFunctions, itemIndex: number): Promise<unknown> {
	return requestWithFallback.call(this, itemIndex, [
		{ method: 'GET', path: API_BASE },
		{ method: 'GET', path: `${ADMIN_BASE}.json` },
		{ method: 'GET', path: `${LEGACY_ADMIN_BASE}.json` },
	]);
}

export async function getQuery(this: IExecuteFunctions, itemIndex: number, queryId: number): Promise<unknown> {
	return requestWithFallback.call(this, itemIndex, [
		{ method: 'GET', path: `${API_BASE}/${queryId}` },
		{ method: 'GET', path: `${ADMIN_BASE}/${queryId}.json` },
		{ method: 'GET', path: `${LEGACY_ADMIN_BASE}/${queryId}.json` },
	]);
}

export async function createQuery(
	this: IExecuteFunctions,
	itemIndex: number,
	payload: QueryWritePayload,
): Promise<unknown> {
	return requestWithFallback.call(this, itemIndex, [
		{ method: 'POST', path: API_BASE, body: toApiWritePayload(payload) },
		{ method: 'POST', path: ADMIN_BASE, body: toAdminWritePayload(payload) },
		{ method: 'POST', path: LEGACY_ADMIN_BASE, body: toAdminWritePayload(payload) },
	]);
}

export async function updateQuery(
	this: IExecuteFunctions,
	itemIndex: number,
	queryId: number,
	payload: QueryWritePayload,
): Promise<unknown> {
	return requestWithFallback.call(this, itemIndex, [
		{ method: 'PUT', path: `${API_BASE}/${queryId}`, body: toApiWritePayload(payload) },
		{ method: 'PUT', path: `${ADMIN_BASE}/${queryId}`, body: toAdminWritePayload(payload) },
		{ method: 'PUT', path: `${LEGACY_ADMIN_BASE}/${queryId}`, body: toAdminWritePayload(payload) },
	]);
}

export async function deleteQuery(
	this: IExecuteFunctions,
	itemIndex: number,
	queryId: number,
): Promise<unknown> {
	return requestWithFallback.call(this, itemIndex, [
		{ method: 'DELETE', path: `${API_BASE}/${queryId}` },
		{ method: 'DELETE', path: `${ADMIN_BASE}/${queryId}` },
		{ method: 'DELETE', path: `${LEGACY_ADMIN_BASE}/${queryId}` },
	]);
}

export async function runQuery(
	this: IExecuteFunctions,
	itemIndex: number,
	queryId: number,
	params?: IDataObject,
): Promise<unknown> {
	const serializedParams = serializeParams(params);
	const qs: IDataObject = {};
	const body: IDataObject = {};

	if (serializedParams) {
		qs.params = serializedParams;
		body.params = serializedParams;
	}

	return requestWithFallback.call(this, itemIndex, [
		{ method: 'GET', path: `${API_BASE}/${queryId}/run`, qs },
		{ method: 'GET', path: `${PUBLIC_RUN_BASE}/${queryId}/run`, qs },
		{ method: 'POST', path: `${ADMIN_BASE}/${queryId}/run`, body },
		{ method: 'POST', path: `${LEGACY_ADMIN_BASE}/${queryId}/run`, body },
	]);
}

import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { discourseApiRequest } from '../../transport';

const ARTIFACT_STORAGE_BASE = '/discourse-ai/ai-bot/artifact-key-values';

function isDataObject(value: unknown): value is IDataObject {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

export type ArtifactKeyValuesEnvelope = {
	raw: IDataObject;
	keyValues: IDataObject[];
	users: IDataObject[];
	hasMore: boolean;
	totalCount?: number;
};

export function extractArtifactKeyValueEntry(response: unknown): IDataObject | null {
	if (!isDataObject(response)) {
		return null;
	}

	if (isDataObject(response.key_value)) {
		return response.key_value;
	}

	if (isDataObject(response.artifact_key_value)) {
		return response.artifact_key_value;
	}

	if (typeof response.key === 'string') {
		return response;
	}

	if (Array.isArray(response.key_values)) {
		const firstEntry = response.key_values.find((item) => isDataObject(item));
		if (firstEntry) {
			return firstEntry;
		}
	}

	return null;
}

export function extractArtifactKeyValuesEnvelope(response: unknown): ArtifactKeyValuesEnvelope {
	if (!isDataObject(response)) {
		return {
			raw: {},
			keyValues: [],
			users: [],
			hasMore: false,
		};
	}

	const keyValues = Array.isArray(response.key_values)
		? response.key_values.filter((item): item is IDataObject => isDataObject(item))
		: [];
	const users = Array.isArray(response.users)
		? response.users.filter((item): item is IDataObject => isDataObject(item))
		: [];

	const totalCountRaw = Number(response.total_count);
	const totalCount = Number.isFinite(totalCountRaw) ? Math.trunc(totalCountRaw) : undefined;

	return {
		raw: response,
		keyValues,
		users,
		hasMore: Boolean(response.has_more),
		totalCount,
	};
}

export async function listArtifactKeyValues(
	this: IExecuteFunctions,
	itemIndex: number,
	artifactId: number,
	qs: IDataObject = {},
): Promise<unknown> {
	return discourseApiRequest.call(this, itemIndex, 'GET', `${ARTIFACT_STORAGE_BASE}/${artifactId}`, qs);
}

export async function setArtifactKeyValue(
	this: IExecuteFunctions,
	itemIndex: number,
	artifactId: number,
	body: IDataObject,
): Promise<unknown> {
	return discourseApiRequest.call(this, itemIndex, 'POST', `${ARTIFACT_STORAGE_BASE}/${artifactId}`, {}, body);
}

export async function deleteArtifactKeyValue(
	this: IExecuteFunctions,
	itemIndex: number,
	artifactId: number,
	key: string,
): Promise<unknown> {
	return discourseApiRequest.call(
		this,
		itemIndex,
		'DELETE',
		`${ARTIFACT_STORAGE_BASE}/${artifactId}/${encodeURIComponent(key)}`,
	);
}

import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { discourseApiRequest } from '../../transport';

const ARTIFACTS_BASE = '/admin/plugins/discourse-ai/ai-artifacts';

function isDataObject(value: unknown): value is IDataObject {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toAiArtifactPayload(payload: IDataObject): IDataObject {
	return {
		ai_artifact: payload,
	};
}

export function extractAiArtifact(response: unknown): IDataObject | null {
	if (!isDataObject(response)) {
		return null;
	}

	if (isDataObject(response.ai_artifact)) {
		return response.ai_artifact;
	}

	if (response.id !== undefined) {
		return response;
	}

	return null;
}

export function extractAiArtifactList(response: unknown): { artifacts: IDataObject[]; meta: IDataObject } {
	if (!isDataObject(response)) {
		return {
			artifacts: [],
			meta: {},
		};
	}

	const artifacts = Array.isArray(response.artifacts)
		? response.artifacts.filter((item): item is IDataObject => isDataObject(item))
		: [];
	const meta = isDataObject(response.meta) ? response.meta : {};

	return {
		artifacts,
		meta,
	};
}

export async function listAiArtifacts(
	this: IExecuteFunctions,
	itemIndex: number,
	qs: IDataObject,
): Promise<unknown> {
	return discourseApiRequest.call(this, itemIndex, 'GET', `${ARTIFACTS_BASE}.json`, qs);
}

export async function getAiArtifact(
	this: IExecuteFunctions,
	itemIndex: number,
	artifactId: number,
): Promise<unknown> {
	return discourseApiRequest.call(this, itemIndex, 'GET', `${ARTIFACTS_BASE}/${artifactId}.json`);
}

export async function createAiArtifact(
	this: IExecuteFunctions,
	itemIndex: number,
	payload: IDataObject,
): Promise<unknown> {
	return discourseApiRequest.call(
		this,
		itemIndex,
		'POST',
		`${ARTIFACTS_BASE}.json`,
		{},
		toAiArtifactPayload(payload),
	);
}

export async function updateAiArtifact(
	this: IExecuteFunctions,
	itemIndex: number,
	artifactId: number,
	payload: IDataObject,
): Promise<unknown> {
	return discourseApiRequest.call(
		this,
		itemIndex,
		'PUT',
		`${ARTIFACTS_BASE}/${artifactId}.json`,
		{},
		toAiArtifactPayload(payload),
	);
}

export async function deleteAiArtifact(
	this: IExecuteFunctions,
	itemIndex: number,
	artifactId: number,
): Promise<unknown> {
	return discourseApiRequest.call(this, itemIndex, 'DELETE', `${ARTIFACTS_BASE}/${artifactId}.json`);
}

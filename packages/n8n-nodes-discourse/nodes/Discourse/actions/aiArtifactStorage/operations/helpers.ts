import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { extractArtifactKeyValuesEnvelope, listArtifactKeyValues } from '../api';

export function normalizeStorageKey(key: string): string {
	const normalizedKey = key.trim();
	if (!normalizedKey) {
		throw new Error('Key must not be empty.');
	}

	return normalizedKey;
}

export async function findStorageEntryByKey(
	this: IExecuteFunctions,
	itemIndex: number,
	artifactId: number,
	key: string,
): Promise<IDataObject | null> {
	const response = await listArtifactKeyValues.call(this, itemIndex, artifactId, {
		key,
		per_page: 100,
		page: 1,
	});
	const envelope = extractArtifactKeyValuesEnvelope(response);

	const matchedEntry = envelope.keyValues.find((entry) => String(entry.key ?? '') === key);
	return matchedEntry ?? null;
}

export function toStorageKeyValuePayload(
	entry: IDataObject,
	artifactId: number,
	operation?: 'create' | 'update',
): IDataObject {
	const payload: IDataObject = {
		artifact_id: artifactId,
		key: entry.key,
		value: entry.value,
		public: entry.public,
		user_id: entry.user_id,
	};

	if (operation) {
		payload.operation = operation;
	}

	return payload;
}

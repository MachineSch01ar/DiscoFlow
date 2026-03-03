import type { IDataObject } from 'n8n-workflow';
import { getPostId, parseJsonObjectInput } from '../../utils';

export function requirePositiveInteger(value: unknown, fieldName: string): number {
	const parsedValue = Number(value);
	if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
		throw new Error(`${fieldName} must be a positive integer.`);
	}

	return parsedValue;
}

export function resolvePostId(postInput: unknown): number {
	return getPostId(postInput);
}

export function buildCreateMetadata(metadataInput: unknown, isPublic: boolean): IDataObject {
	const metadata = parseJsonObjectInput(metadataInput, 'Metadata JSON') ?? {};
	metadata.public = isPublic;
	return metadata;
}

export function buildUpdateMetadata(
	metadataInput: unknown,
	hasPublicField: boolean,
	publicValue: boolean,
): IDataObject | undefined {
	const metadata = parseJsonObjectInput(metadataInput, 'Metadata JSON');

	if (!metadata && !hasPublicField) {
		return undefined;
	}

	const nextMetadata = metadata ? { ...metadata } : {};
	if (hasPublicField) {
		nextMetadata.public = publicValue;
	}

	return nextMetadata;
}

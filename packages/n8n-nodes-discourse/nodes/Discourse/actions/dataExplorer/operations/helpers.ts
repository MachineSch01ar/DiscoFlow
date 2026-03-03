import type { IDataObject } from 'n8n-workflow';

function isDataObject(value: unknown): value is IDataObject {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parseParamsInput(paramsInput: unknown): IDataObject | undefined {
	if (paramsInput === undefined || paramsInput === null || paramsInput === '') {
		return undefined;
	}

	if (typeof paramsInput === 'string') {
		const trimmed = paramsInput.trim();
		if (!trimmed) {
			return undefined;
		}

		const parsed = JSON.parse(trimmed);
		if (!isDataObject(parsed)) {
			throw new Error('Params JSON must be a JSON object.');
		}

		return parsed;
	}

	if (!isDataObject(paramsInput)) {
		throw new Error('Params JSON must be a JSON object.');
	}

	return paramsInput;
}

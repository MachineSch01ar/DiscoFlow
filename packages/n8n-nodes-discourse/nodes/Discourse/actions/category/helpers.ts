import type { IDataObject } from 'n8n-workflow';

function isDataObject(value: unknown): value is IDataObject {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parsePermissionsInput(permissionsInput: unknown): IDataObject | undefined {
	if (permissionsInput === undefined || permissionsInput === null || permissionsInput === '') {
		return undefined;
	}

	if (typeof permissionsInput === 'string') {
		const trimmed = permissionsInput.trim();
		if (!trimmed) {
			return undefined;
		}

		const parsed = JSON.parse(trimmed);
		if (!isDataObject(parsed)) {
			throw new Error('Permissions JSON must be a JSON object.');
		}

		return parsed;
	}

	if (!isDataObject(permissionsInput)) {
		throw new Error('Permissions JSON must be a JSON object.');
	}

	return permissionsInput;
}

export function normalizeHexColor(color: string): string {
	return color.trim().replace(/^#/, '');
}

export function getCategoriesFromResponse(response: unknown): IDataObject[] {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return [];
	}

	const data = response as IDataObject;

	if (Array.isArray(data.categories)) {
		return data.categories.filter((item): item is IDataObject => !!item && typeof item === 'object');
	}

	const categoryList = data.category_list as IDataObject | undefined;
	if (!categoryList || typeof categoryList !== 'object') {
		return [];
	}

	const categories = categoryList.categories;
	if (!Array.isArray(categories)) {
		return [];
	}

	return categories.filter((item): item is IDataObject => !!item && typeof item === 'object');
}

export function extractCategory(response: unknown): IDataObject | undefined {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return undefined;
	}

	const data = response as IDataObject;
	if (data.category && typeof data.category === 'object' && !Array.isArray(data.category)) {
		return data.category as IDataObject;
	}

	if ('id' in data || 'name' in data || 'slug' in data) {
		return data;
	}

	return undefined;
}

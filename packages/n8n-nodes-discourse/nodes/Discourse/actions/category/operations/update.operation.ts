import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getCategoryId, toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { normalizeHexColor, parsePermissionsInput } from '../helpers';

const displayOptions = {
	show: {
		resource: ['category'],
		operation: ['update'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Category ID or URL',
		name: 'categoryId',
		type: 'resourceLocator',
		default: {
			mode: 'id',
			value: '',
		},
		required: true,
		displayOptions,
		modes: [
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: '42',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				placeholder: 'https://forum.example.com/c/category-name/42',
				extractValue: {
					type: 'regex',
					regex: '/c/(?:[^/]+/)*(\\d+)',
				},
			},
		],
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		default: {},
		displayOptions,
		placeholder: 'Add Field',
		options: [
			{
				displayName: 'Color',
				name: 'color',
				type: 'color',
				default: '',
				description: 'Optional hex color for the category (with or without #)',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Parent Category ID',
				name: 'parentCategoryId',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 1,
				},
			},
			{
				displayName: 'Permissions JSON',
				name: 'permissionsJson',
				type: 'json',
				default: '',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
				},
			},
			{
				displayName: 'Read Restricted',
				name: 'readRestricted',
				type: 'boolean',
				default: false,
				description: 'Whether category visibility should be restricted by group permissions',
			},
			{
				displayName: 'Search Priority',
				name: 'searchPriority',
				type: 'number',
				default: 0,
			},
			{
				displayName: 'Slug',
				name: 'slug',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Text Color',
				name: 'textColor',
				type: 'color',
				default: '',
				description: 'Optional hex text color for the category (with or without #)',
			},
			{
				displayName: 'Topic Template',
				name: 'topicTemplate',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const categoryIdInput = this.getNodeParameter('categoryId', itemIndex);
	const updateFields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;

	let categoryId: number;
	try {
		categoryId = getCategoryId(categoryIdInput);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const body: IDataObject = {};

	if ('name' in updateFields && typeof updateFields.name === 'string') {
		const name = updateFields.name.trim();
		if (!name) {
			throw new NodeOperationError(this.getNode(), 'Name cannot be empty.', { itemIndex });
		}
		body.name = name;
	}

	if ('slug' in updateFields && typeof updateFields.slug === 'string') {
		const slug = updateFields.slug.trim();
		if (!slug) {
			throw new NodeOperationError(this.getNode(), 'Slug cannot be empty.', { itemIndex });
		}
		body.slug = slug;
	}

	if ('color' in updateFields && typeof updateFields.color === 'string') {
		const color = normalizeHexColor(updateFields.color);
		if (!color) {
			throw new NodeOperationError(this.getNode(), 'Color cannot be empty.', { itemIndex });
		}
		body.color = color;
	}

	if ('textColor' in updateFields && typeof updateFields.textColor === 'string') {
		const textColor = normalizeHexColor(updateFields.textColor);
		if (!textColor) {
			throw new NodeOperationError(this.getNode(), 'Text Color cannot be empty.', {
				itemIndex,
			});
		}
		body.text_color = textColor;
	}

	if ('description' in updateFields && typeof updateFields.description === 'string') {
		body.description = updateFields.description;
	}

	if ('topicTemplate' in updateFields && typeof updateFields.topicTemplate === 'string') {
		body.topic_template = updateFields.topicTemplate;
	}

	if ('parentCategoryId' in updateFields) {
		const parentCategoryId = Number(updateFields.parentCategoryId);
		if (!Number.isFinite(parentCategoryId) || parentCategoryId <= 0) {
			throw new NodeOperationError(this.getNode(), 'Parent Category ID must be a positive number.', {
				itemIndex,
			});
		}
		body.parent_category_id = Math.trunc(parentCategoryId);
	}

	if ('position' in updateFields) {
		const position = Number(updateFields.position);
		if (!Number.isFinite(position) || position < 0) {
			throw new NodeOperationError(this.getNode(), 'Position must be a non-negative number.', {
				itemIndex,
			});
		}
		body.position = Math.trunc(position);
	}

	if ('searchPriority' in updateFields) {
		const searchPriority = Number(updateFields.searchPriority);
		if (!Number.isFinite(searchPriority)) {
			throw new NodeOperationError(this.getNode(), 'Search Priority must be a number.', {
				itemIndex,
			});
		}
		body.search_priority = searchPriority;
	}

	if ('readRestricted' in updateFields) {
		body.read_restricted = Boolean(updateFields.readRestricted);
	}

	if ('permissionsJson' in updateFields) {
		try {
			const permissions = parsePermissionsInput(updateFields.permissionsJson);
			if (permissions) {
				body.permissions = permissions;
			}
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
		}
	}

	if (Object.keys(body).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Provide at least one update field.', {
			itemIndex,
		});
	}

	const response = await discourseApiRequest.call(
		this,
		itemIndex,
		'PUT',
		`/categories/${categoryId}.json`,
		{},
		body,
	);

	return toExecutionData(itemIndex, response);
}

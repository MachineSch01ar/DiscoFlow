import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';
import { normalizeHexColor, parsePermissionsInput } from '../helpers';

const displayOptions = {
	show: {
		resource: ['category'],
		operation: ['create'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Name for the new category',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
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
				description:
					'Optional group permission map. Example: {"staff":1,"everyone":1}.',
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
	const nameInput = this.getNodeParameter('name', itemIndex) as string;
	const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

	const name = nameInput.trim();
	if (!name) {
		throw new NodeOperationError(this.getNode(), 'Name is required.', { itemIndex });
	}

	const body: IDataObject = {
		name,
	};

	if ('slug' in additionalFields && typeof additionalFields.slug === 'string') {
		const slug = additionalFields.slug.trim();
		if (slug) {
			body.slug = slug;
		}
	}

	if ('color' in additionalFields && typeof additionalFields.color === 'string') {
		const color = normalizeHexColor(additionalFields.color);
		if (color) {
			body.color = color;
		}
	}

	if ('textColor' in additionalFields && typeof additionalFields.textColor === 'string') {
		const textColor = normalizeHexColor(additionalFields.textColor);
		if (textColor) {
			body.text_color = textColor;
		}
	}

	if ('description' in additionalFields && typeof additionalFields.description === 'string') {
		const description = additionalFields.description.trim();
		if (description) {
			body.description = description;
		}
	}

	if ('topicTemplate' in additionalFields && typeof additionalFields.topicTemplate === 'string') {
		const topicTemplate = additionalFields.topicTemplate.trim();
		if (topicTemplate) {
			body.topic_template = topicTemplate;
		}
	}

	if ('parentCategoryId' in additionalFields) {
		const parentCategoryId = Number(additionalFields.parentCategoryId);
		if (Number.isFinite(parentCategoryId) && parentCategoryId > 0) {
			body.parent_category_id = Math.trunc(parentCategoryId);
		}
	}

	if ('position' in additionalFields) {
		const position = Number(additionalFields.position);
		if (!Number.isFinite(position) || position < 0) {
			throw new NodeOperationError(this.getNode(), 'Position must be a non-negative number.', {
				itemIndex,
			});
		}
		body.position = Math.trunc(position);
	}

	if ('searchPriority' in additionalFields) {
		const searchPriority = Number(additionalFields.searchPriority);
		if (!Number.isFinite(searchPriority)) {
			throw new NodeOperationError(this.getNode(), 'Search Priority must be a number.', {
				itemIndex,
			});
		}
		body.search_priority = searchPriority;
	}

	if ('readRestricted' in additionalFields) {
		body.read_restricted = Boolean(additionalFields.readRestricted);
	}

	if ('permissionsJson' in additionalFields) {
		try {
			const permissions = parsePermissionsInput(additionalFields.permissionsJson);
			if (permissions) {
				body.permissions = permissions;
			}
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
		}
	}

	const response = await discourseApiRequest.call(this, itemIndex, 'POST', '/categories.json', {}, body);

	return toExecutionData(itemIndex, response);
}

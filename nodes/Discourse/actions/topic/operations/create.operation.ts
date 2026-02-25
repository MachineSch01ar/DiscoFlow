import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { toExecutionData } from '../../utils';
import { discourseApiRequest } from '../../../transport';

const displayOptions = {
	show: {
		resource: ['topic'],
		operation: ['create'],
	},
};

export const description: INodeProperties[] = [
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'Title for the new topic',
	},
	{
		displayName: 'Raw',
		name: 'raw',
		type: 'string',
		typeOptions: {
			rows: 6,
		},
		default: '',
		required: true,
		displayOptions,
		description: 'Raw post body for the topic',
	},
	{
		displayName: 'Category ID',
		name: 'categoryId',
		type: 'number',
		default: 0,
		displayOptions,
		description: 'Optional category ID for the topic',
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
				displayName: 'Auto Track',
				name: 'autoTrack',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Created At',
				name: 'createdAt',
				type: 'dateTime',
				default: '',
				description: 'Optional creation timestamp for imports/migrations',
			},
			{
				displayName: 'Embed URL',
				name: 'embedUrl',
				type: 'string',
				default: '',
			},
			{
				displayName: 'External ID',
				name: 'externalId',
				type: 'string',
				default: '',
				description: 'External identifier to associate with the topic',
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const title = this.getNodeParameter('title', itemIndex) as string;
	const raw = this.getNodeParameter('raw', itemIndex) as string;
	const categoryId = this.getNodeParameter('categoryId', itemIndex) as number;
	const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

	const body: IDataObject = {
		title,
		raw,
	};

	if (categoryId > 0) {
		body.category = categoryId;
	}

	if (additionalFields.createdAt) {
		body.created_at = additionalFields.createdAt;
	}

	if (additionalFields.embedUrl) {
		body.embed_url = additionalFields.embedUrl;
	}

	if (additionalFields.externalId) {
		body.external_id = additionalFields.externalId;
	}

	if (additionalFields.autoTrack !== undefined) {
		body.auto_track = additionalFields.autoTrack;
	}

	const response = await discourseApiRequest.call(this, itemIndex, 'POST', '/posts.json', {}, body);

	return toExecutionData(itemIndex, response);
}

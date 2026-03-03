import type { ICredentialTestRequest, ICredentialType, Icon, INodeProperties } from 'n8n-workflow';

export class DigitalOceanSpacesApi implements ICredentialType {
	name = 'digitalOceanSpacesApi';

	displayName = 'DigitalOcean Spaces API';

	icon: Icon = 'file:../nodes/Discourse/discourse.svg';

	documentationUrl = 'https://docs.digitalocean.com/products/spaces/reference/s3-api/';

	properties: INodeProperties[] = [
		{
			displayName: 'Region',
			name: 'region',
			type: 'string',
			default: 'nyc3',
			required: true,
		},
		{
			displayName: 'Access Key',
			name: 'accessKey',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Secret Key',
			name: 'secretKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
		];

	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: 'https://docs.digitalocean.com/products/spaces/reference/s3-api/',
		},
	};
}

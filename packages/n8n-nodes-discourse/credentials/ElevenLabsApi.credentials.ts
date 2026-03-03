import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class ElevenLabsApi implements ICredentialType {
	name = 'elevenLabsApi';

	displayName = 'ElevenLabs API';

	icon: Icon = 'file:../nodes/Discourse/discourse.svg';

	documentationUrl = 'https://elevenlabs.io/docs/api-reference/overview';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'xi-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: 'https://api.elevenlabs.io/v1/models',
		},
	};
}

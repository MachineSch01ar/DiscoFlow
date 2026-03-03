import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { discourseApiRequest } from '../../../transport';
import { toExecutionData } from '../../utils';
import { resolvePostId } from '../helpers';
import {
	buildTtsMetadataBlock,
	chunkTtsText,
	cleanTextForTts,
	type TtsChunkStrategy,
	type TtsCleaningOptions,
} from '../tts.helpers';

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ['prepareForTts'],
	},
};

const chunkingDisplayOptions = {
	show: {
		resource: ['post'],
		operation: ['prepareForTts'],
		outputMode: ['chunksArray', 'chunkItems'],
	},
};

interface PostForTtsResult {
	postId?: number;
	post?: IDataObject;
	source: 'rawOverride' | 'postRaw' | 'rawEndpoint' | 'postCooked';
	sourceText: string;
	baseUrl: string;
}

function getStatusCode(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') {
		return undefined;
	}

	const data = error as IDataObject;
	const directCode = Number(data.statusCode ?? data.status);
	if (!Number.isNaN(directCode) && directCode > 0) {
		return directCode;
	}

	const response = data.response as IDataObject | undefined;
	if (!response || typeof response !== 'object') {
		return undefined;
	}

	const responseCode = Number((response.statusCode as number | undefined) ?? (response.status as number | undefined));
	if (!Number.isNaN(responseCode) && responseCode > 0) {
		return responseCode;
	}

	return undefined;
}

function getLocatorRawValue(input: unknown): string {
	if (typeof input === 'string') {
		return input.trim();
	}

	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return '';
	}

	return String((input as IDataObject).value ?? '').trim();
}

function hasPostLocatorValue(input: unknown): boolean {
	if (typeof input === 'number') {
		return Number.isFinite(input) && input > 0;
	}

	return getLocatorRawValue(input).length > 0;
}

function getBaseUrlFromCredentials(credentials: IDataObject): string {
	return String(credentials.baseUrl ?? '').trim().replace(/\/+$/, '');
}

function buildTextRequestOptions(
	method: IHttpRequestMethods,
	url: string,
): IHttpRequestOptions {
	return {
		method,
		url,
		json: false,
	};
}

function getRawFromPostResponse(response: unknown): string {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return '';
	}

	const post = response as IDataObject;
	const raw = post.raw;
	if (typeof raw === 'string' && raw.trim()) {
		return raw;
	}

	return '';
}

function getCookedFromPostResponse(response: unknown): string {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return '';
	}

	const post = response as IDataObject;
	const cooked = post.cooked;
	if (typeof cooked === 'string' && cooked.trim()) {
		return cooked;
	}

	return '';
}

async function tryFetchRawTextByPaths(
	this: IExecuteFunctions,
	itemIndex: number,
	baseUrl: string,
	paths: string[],
): Promise<string> {
	for (const path of paths) {
		const url = `${baseUrl}${path}`;
		try {
			const response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				'discourseExtendedApi',
				buildTextRequestOptions('GET', url),
			);

			if (typeof response === 'string' && response.trim()) {
				return response;
			}
		} catch (error) {
			const statusCode = getStatusCode(error);
			if (statusCode && statusCode !== 404) {
				throw error;
			}
		}
	}

	return '';
}

function getCleaningOptions(
	this: IExecuteFunctions,
	itemIndex: number,
): TtsCleaningOptions {
	const defaults: TtsCleaningOptions = {
		removeUrls: true,
		removeImages: true,
		stripCodeBlocks: true,
		normalizeMentions: true,
		normalizeHashtags: true,
		ensureHeadingPunctuation: true,
	};

	const rawOptions = this.getNodeParameter('cleaningOptions', itemIndex, {}) as IDataObject;

	return {
		removeUrls:
			rawOptions.removeUrls === undefined ? defaults.removeUrls : Boolean(rawOptions.removeUrls),
		removeImages:
			rawOptions.removeImages === undefined ? defaults.removeImages : Boolean(rawOptions.removeImages),
		stripCodeBlocks:
			rawOptions.stripCodeBlocks === undefined
				? defaults.stripCodeBlocks
				: Boolean(rawOptions.stripCodeBlocks),
		normalizeMentions:
			rawOptions.normalizeMentions === undefined
				? defaults.normalizeMentions
				: Boolean(rawOptions.normalizeMentions),
		normalizeHashtags:
			rawOptions.normalizeHashtags === undefined
				? defaults.normalizeHashtags
				: Boolean(rawOptions.normalizeHashtags),
		ensureHeadingPunctuation:
			rawOptions.ensureHeadingPunctuation === undefined
				? defaults.ensureHeadingPunctuation
				: Boolean(rawOptions.ensureHeadingPunctuation),
	};
}

async function getPostContentForTts(
	this: IExecuteFunctions,
	itemIndex: number,
	postIdInput: unknown,
	rawTextOverride: string,
	includeMetadataBlock: boolean,
): Promise<PostForTtsResult> {
	const credentials = await this.getCredentials('discourseExtendedApi', itemIndex);
	const baseUrl = getBaseUrlFromCredentials(credentials);
	if (!baseUrl) {
		throw new NodeOperationError(this.getNode(), 'Base URL is missing in Discourse credentials.', {
			itemIndex,
		});
	}

	const hasRawOverride = rawTextOverride.trim().length > 0;
	const hasLocator = hasPostLocatorValue(postIdInput);
	if (!hasRawOverride && !hasLocator) {
		throw new NodeOperationError(this.getNode(), 'Provide either Post ID or URL, or Raw Text Override.', {
			itemIndex,
		});
	}

	const shouldFetchPost = hasLocator && (!hasRawOverride || includeMetadataBlock);
	let postId: number | undefined;
	let postResponse: IDataObject | undefined;

	if (shouldFetchPost) {
		try {
			postId = await resolvePostId.call(this, itemIndex, postIdInput);
		} catch (error) {
			if (!hasRawOverride) {
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}
	}

	if (postId) {
		const response = await discourseApiRequest.call(
			this,
			itemIndex,
			'GET',
			`/posts/${postId}.json`,
			{ include_raw: true },
		);

		if (response && typeof response === 'object' && !Array.isArray(response)) {
			postResponse = response as IDataObject;
		}
	}

	if (hasRawOverride) {
		return {
			postId,
			post: postResponse,
			source: 'rawOverride',
			sourceText: rawTextOverride,
			baseUrl,
		};
	}

	if (!postId || !postResponse) {
		throw new NodeOperationError(
			this.getNode(),
			'Could not fetch post content. Ensure Post ID or URL is valid and accessible.',
			{ itemIndex },
		);
	}

	const rawFromPost = getRawFromPostResponse(postResponse);
	if (rawFromPost) {
		return {
			postId,
			post: postResponse,
			source: 'postRaw',
			sourceText: rawFromPost,
			baseUrl,
		};
	}

	const topicId = Number(postResponse.topic_id ?? 0);
	const postNumber = Number(postResponse.post_number ?? 0);
	const rawFromEndpoint = await tryFetchRawTextByPaths.call(this, itemIndex, baseUrl, [
		topicId > 0 && postNumber > 0 ? `/raw/${topicId}/${postNumber}` : '',
		`/raw/${postId}`,
	].filter((path): path is string => Boolean(path)));

	if (rawFromEndpoint) {
		return {
			postId,
			post: postResponse,
			source: 'rawEndpoint',
			sourceText: rawFromEndpoint,
			baseUrl,
		};
	}

	const cooked = getCookedFromPostResponse(postResponse);
	if (cooked) {
		return {
			postId,
			post: postResponse,
			source: 'postCooked',
			sourceText: cooked,
			baseUrl,
		};
	}

	return {
		postId,
		post: postResponse,
		source: 'postRaw',
		sourceText: '',
		baseUrl,
	};
}

export const description: INodeProperties[] = [
	{
		displayName: 'Post ID or URL',
		name: 'postId',
		type: 'resourceLocator',
		default: {
			mode: 'id',
			value: '',
		},
		displayOptions,
		modes: [
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: '456',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				placeholder: 'https://forum.example.com/p/456 or https://forum.example.com/t/topic-slug/123/4',
			},
		],
		description: 'Provide when you want the node to fetch post content directly from Discourse',
	},
	{
		displayName: 'Raw Text Override',
		name: 'rawTextOverride',
		type: 'string',
		typeOptions: {
			rows: 6,
		},
		default: '',
		displayOptions,
		description:
			'Optional direct text input to clean for TTS. When set, this text is used instead of fetched post body.',
	},
	{
		displayName: 'Include Metadata Block',
		name: 'includeMetadataBlock',
		type: 'boolean',
		default: false,
		displayOptions,
		description: 'Whether to prepend a short spoken metadata preamble to the cleaned text',
	},
	{
		displayName: 'Output Mode',
		name: 'outputMode',
		type: 'options',
		default: 'singleText',
		displayOptions,
		options: [
			{
				name: 'Single Text',
				value: 'singleText',
			},
			{
				name: 'Chunks Array',
				value: 'chunksArray',
			},
			{
				name: 'Chunk Items',
				value: 'chunkItems',
			},
		],
		description: 'How cleaned text should be returned for downstream TTS operations',
	},
	{
		displayName: 'Chunk Strategy',
		name: 'chunkStrategy',
		type: 'options',
		default: 'sentenceAware',
		displayOptions: chunkingDisplayOptions,
		options: [
			{
				name: 'Sentence Aware',
				value: 'sentenceAware',
			},
			{
				name: 'Paragraph Aware',
				value: 'paragraphAware',
			},
		],
		description: 'How the node splits cleaned text into chunks',
	},
	{
		displayName: 'Max Chunk Length',
		name: 'maxChunkLength',
		type: 'number',
		default: 2500,
		typeOptions: {
			minValue: 200,
		},
		displayOptions: chunkingDisplayOptions,
		description: 'Maximum character length per chunk',
	},
	{
		displayName: 'Cleaning Options',
		name: 'cleaningOptions',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		displayOptions,
		options: [
			{
				displayName: 'Ensure Heading Punctuation',
				name: 'ensureHeadingPunctuation',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Normalize Hashtags',
				name: 'normalizeHashtags',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Normalize Mentions',
				name: 'normalizeMentions',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Remove Images',
				name: 'removeImages',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Remove URLs',
				name: 'removeUrls',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Strip Code Blocks',
				name: 'stripCodeBlocks',
				type: 'boolean',
				default: true,
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const postIdInput = this.getNodeParameter('postId', itemIndex);
	const rawTextOverride = this.getNodeParameter('rawTextOverride', itemIndex, '') as string;
	const includeMetadataBlock = this.getNodeParameter('includeMetadataBlock', itemIndex, false) as boolean;
	const outputMode = this.getNodeParameter('outputMode', itemIndex, 'singleText') as string;
	const chunkStrategy = this.getNodeParameter('chunkStrategy', itemIndex, 'sentenceAware') as TtsChunkStrategy;
	const maxChunkLength = this.getNodeParameter('maxChunkLength', itemIndex, 2500) as number;
	const cleaningOptions = getCleaningOptions.call(this, itemIndex);

	const sourceData = await getPostContentForTts.call(
		this,
		itemIndex,
		postIdInput,
		rawTextOverride,
		includeMetadataBlock,
	);

	let workingText = sourceData.sourceText ?? '';
	if (includeMetadataBlock && sourceData.post) {
		const metadataBlock = buildTtsMetadataBlock(sourceData.post, sourceData.baseUrl);
		if (metadataBlock) {
			workingText = `${metadataBlock}\n\n${workingText}`;
		}
	}

	const cleanedText = cleanTextForTts(workingText, cleaningOptions);
	const metadata: IDataObject = {
		source: sourceData.source,
		original_length: workingText.length,
		cleaned_length: cleanedText.length,
	};

	if (sourceData.postId) {
		metadata.post_id = sourceData.postId;
	}

	if (sourceData.post && typeof sourceData.post.topic_id === 'number') {
		metadata.topic_id = sourceData.post.topic_id;
	}

	if (sourceData.post && typeof sourceData.post.post_number === 'number') {
		metadata.post_number = sourceData.post.post_number;
	}

	if (outputMode === 'singleText') {
		return toExecutionData(itemIndex, {
			text: cleanedText,
			...metadata,
		});
	}

	const chunks = chunkTtsText(cleanedText, Math.trunc(maxChunkLength), chunkStrategy);

	if (outputMode === 'chunksArray') {
		return toExecutionData(itemIndex, {
			text: cleanedText,
			chunks,
			chunk_count: chunks.length,
			chunk_strategy: chunkStrategy,
			max_chunk_length: Math.trunc(maxChunkLength),
			...metadata,
		});
	}

	return toExecutionData(
		itemIndex,
		chunks.map((chunk, index) => ({
			text: chunk,
			chunk_index: index + 1,
			chunk_count: chunks.length,
			chunk_strategy: chunkStrategy,
			max_chunk_length: Math.trunc(maxChunkLength),
			...metadata,
		})),
	);
}

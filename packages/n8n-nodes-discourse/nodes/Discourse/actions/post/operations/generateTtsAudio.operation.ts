import type {
	IBinaryKeyData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeProperties,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { chunkTtsText, type TtsChunkStrategy } from '../tts.helpers';

declare function require(moduleName: string): unknown;
interface BufferLike {
	length: number;
	[index: number]: number;
	slice: (start?: number, end?: number) => BufferLike;
}
interface WritableBufferLike extends BufferLike {
	write: (value: string, offset?: number, lengthOrEncoding?: number | string, encoding?: string) => number;
	writeUInt16LE: (value: number, offset: number) => number;
	writeUInt32LE: (value: number, offset: number) => number;
}
declare const Buffer: {
	alloc: (size: number) => WritableBufferLike;
	concat: (list: unknown[]) => BufferLike;
	from: (data: unknown, encodingOrOffset?: unknown, length?: number) => BufferLike;
	isBuffer: (value: unknown) => boolean;
};

const cryptoModule = require('crypto') as {
	createHash: (algorithm: string) => {
		update: (input: unknown) => {
			digest: (encoding?: string) => unknown;
		};
	};
	createHmac: (algorithm: string, key: unknown) => {
		update: (input: unknown) => {
			digest: (encoding?: string) => unknown;
		};
	};
};
const { createHash, createHmac } = cryptoModule;

type BinaryBuffer = BufferLike;

const ttsOperationValues = ['generateTtsAudio', 'generateTtsAudioWithSpacesUpload'];
const ttsWithSpacesUploadOperationValues = ['generateTtsAudioWithSpacesUpload'];

const displayOptions = {
	show: {
		resource: ['post'],
		operation: ttsOperationValues,
	},
};

const transcriptDisplayOptions = {
	show: {
		resource: ['post'],
		operation: ttsOperationValues,
		generateTranscript: [true],
	},
};

const spacesDisplayOptions = {
	show: {
		resource: ['post'],
		operation: ttsWithSpacesUploadOperationValues,
	},
};

const binaryDisplayOptions = {
	show: {
		resource: ['post'],
		operation: ttsOperationValues,
		includeBinaryData: [true],
	},
};

const binaryTranscriptDisplayOptions = {
	show: {
		resource: ['post'],
		operation: ttsOperationValues,
		includeBinaryData: [true],
		generateTranscript: [true],
	},
};

const FALLBACK_MODEL_CHAR_LIMITS: Record<string, number> = {
	eleven_english_sts_v1: 10000,
	eleven_english_sts_v2: 10000,
	eleven_flash_v2: 30000,
	eleven_flash_v2_5: 40000,
	eleven_monolingual_v1: 10000,
	eleven_multilingual_v1: 10000,
	eleven_multilingual_v2: 10000,
	eleven_turbo_v2: 30000,
	eleven_turbo_v2_5: 40000,
	eleven_v3: 5000,
};

type AudioFormat = 'mp3' | 'wav';
type TranscriptOutputMode = 'alignmentJsonOnly' | 'textAndAlignmentJson' | 'textOnly';

interface ElevenLabsAlignment {
	characters: string[];
	characterStartTimesSeconds: number[];
	characterEndTimesSeconds: number[];
}

interface GeneratedChunk {
	text: string;
	audio: BinaryBuffer;
	alignment?: ElevenLabsAlignment;
	durationSeconds: number;
	durationSource: 'alignment' | 'estimated' | 'unknown';
}

interface SpacesCredentials {
	accessKey: string;
	secretKey: string;
	region: string;
}

interface RetryConfig {
	maxRetries: number;
	retryBaseDelayMs: number;
	retryJitterRatio: number;
	retryMaxDelayMs: number;
}

interface RetryStats {
	maxDelayMs: number;
	retryEvents: number;
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

function extractErrorText(error: unknown): string {
	if (!error || typeof error !== 'object') {
		return '';
	}

	const data = error as IDataObject;
	const directMessage = data.message;
	if (typeof directMessage === 'string' && directMessage.trim()) {
		return directMessage;
	}

	const response = data.response as IDataObject | undefined;
	const responseBody = response?.body;
	if (typeof responseBody === 'string' && responseBody.trim()) {
		return responseBody;
	}

	if (responseBody && typeof responseBody === 'object') {
		try {
			return JSON.stringify(responseBody);
		} catch {
			return String(responseBody);
		}
	}

	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

function getHeaderValue(headers: IDataObject | undefined, headerName: string): string | undefined {
	if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
		return undefined;
	}

	const directValue = headers[headerName] ?? headers[headerName.toLowerCase()] ?? headers[headerName.toUpperCase()];
	if (typeof directValue === 'string') {
		return directValue;
	}

	if (typeof directValue === 'number') {
		return String(directValue);
	}

	if (Array.isArray(directValue) && typeof directValue[0] === 'string') {
		return directValue[0];
	}

	return undefined;
}

function parsePositiveNumber(input: unknown): number | undefined {
	const value = Number(input);
	if (!Number.isFinite(value) || value <= 0) {
		return undefined;
	}
	return value;
}

function parseRetryAfterMs(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') {
		return undefined;
	}

	const data = error as IDataObject;
	const response =
		data.response && typeof data.response === 'object' && !Array.isArray(data.response)
			? (data.response as IDataObject)
			: undefined;
	const headers =
		response?.headers && typeof response.headers === 'object' && !Array.isArray(response.headers)
			? (response.headers as IDataObject)
			: undefined;
	const retryAfter = getHeaderValue(headers, 'retry-after');
	if (!retryAfter) {
		return undefined;
	}

	const seconds = Number(retryAfter);
	if (Number.isFinite(seconds) && seconds >= 0) {
		return Math.round(seconds * 1000);
	}

	const dateMs = Date.parse(retryAfter);
	if (!Number.isNaN(dateMs)) {
		const delta = dateMs - Date.now();
		return delta > 0 ? delta : 0;
	}

	return undefined;
}

function computeBackoffDelayMs(attempt: number, config: RetryConfig, retryAfterMs?: number): number {
	if (retryAfterMs !== undefined && retryAfterMs >= 0) {
		return retryAfterMs;
	}

	const exponentialDelay = Math.min(config.retryMaxDelayMs, config.retryBaseDelayMs * 2 ** attempt);
	const jitterSpread = exponentialDelay * config.retryJitterRatio;
	const jitterOffset = (Math.random() * 2 - 1) * jitterSpread;
	return Math.max(0, Math.round(exponentialDelay + jitterOffset));
}

async function waitForDelayMs(delayMs: number): Promise<void> {
	if (delayMs <= 0) {
		return;
	}

	const endAt = Date.now() + delayMs;
	while (Date.now() < endAt) {
		await Promise.resolve();
	}
}

function formatUtcTimestamp(now: Date): string {
	const iso = now.toISOString();
	return iso.replace(/[:-]|\.\d{3}/g, '');
}

function formatDatestamp(amzTimestamp: string): string {
	return amzTimestamp.slice(0, 8);
}

function normalizeFileStem(input: string): string {
	const sanitized = input
		.trim()
		.replace(/[\\/]/g, '-')
		.replace(/\.[A-Za-z0-9]{1,6}$/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^A-Za-z0-9_-]/g, '');

	return sanitized;
}

function generateFileStem(text: string): string {
	const words = text
		.replace(/[^A-Za-z0-9\s]/g, ' ')
		.split(/\s+/)
		.map((word) => word.trim().toLowerCase())
		.filter((word) => word.length > 0)
		.slice(0, 6);

	const base = words.length > 0 ? words.join('-') : 'tts-audio';
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	return `${base}-${timestamp}`;
}

function getElevenLabsOutputFormat(audioFormat: AudioFormat): string {
	if (audioFormat === 'wav') {
		return 'pcm_44100';
	}

	return 'mp3_44100_128';
}

function isChunkLengthError(error: unknown): boolean {
	const statusCode = getStatusCode(error);
	if (statusCode !== undefined && ![400, 413, 422].includes(statusCode)) {
		return false;
	}

	const text = extractErrorText(error).toLowerCase();
	if (!text) {
		return false;
	}

	return /(too long|max(?:imum)?|character|length|limit)/.test(text);
}

function splitAtNaturalBoundary(value: string): [string, string] | null {
	const text = value.trim();
	if (text.length < 2) {
		return null;
	}

	const midpoint = Math.floor(text.length / 2);
	const minBoundary = Math.floor(text.length * 0.2);
	const maxBoundary = Math.ceil(text.length * 0.8);

	let bestIndex = -1;
	let bestDistance = Number.POSITIVE_INFINITY;
	const punctuationPattern = /[.!?]\s+|\n{2,}|\s+/g;
	let match: RegExpExecArray | null;
	while ((match = punctuationPattern.exec(text)) !== null) {
		const candidateIndex = match.index + match[0].length;
		if (candidateIndex <= minBoundary || candidateIndex >= maxBoundary) {
			continue;
		}

		const distance = Math.abs(candidateIndex - midpoint);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestIndex = candidateIndex;
		}
	}

	if (bestIndex < 0) {
		bestIndex = text.lastIndexOf(' ', midpoint);
	}
	if (bestIndex <= 0 || bestIndex >= text.length - 1) {
		bestIndex = text.indexOf(' ', midpoint);
	}
	if (bestIndex <= 0 || bestIndex >= text.length - 1) {
		return null;
	}

	const left = text.slice(0, bestIndex).trim();
	const right = text.slice(bestIndex).trim();
	if (!left || !right) {
		return null;
	}

	return [left, right];
}

function toBuffer(body: unknown): BinaryBuffer {
	if (Buffer.isBuffer(body)) {
		return body as BinaryBuffer;
	}

	if (body instanceof ArrayBuffer) {
		return Buffer.from(body);
	}

	if (ArrayBuffer.isView(body)) {
		return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	}

	if (typeof body === 'string') {
		return Buffer.from(body);
	}

	throw new Error('Unable to parse ElevenLabs response body as audio buffer');
}

function parseAlignment(input: unknown): ElevenLabsAlignment | undefined {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return undefined;
	}

	const data = input as IDataObject;
	const characters = Array.isArray(data.characters) ? data.characters.map((item) => String(item ?? '')) : [];
	const starts = Array.isArray(data.character_start_times_seconds)
		? data.character_start_times_seconds.map((item) => Number(item ?? 0))
		: [];
	const ends = Array.isArray(data.character_end_times_seconds)
		? data.character_end_times_seconds.map((item) => Number(item ?? 0))
		: [];

	const count = Math.min(characters.length, starts.length, ends.length);
	if (count === 0) {
		return undefined;
	}

	return {
		characters: characters.slice(0, count),
		characterStartTimesSeconds: starts.slice(0, count),
		characterEndTimesSeconds: ends.slice(0, count),
	};
}

function durationFromAlignment(alignment?: ElevenLabsAlignment): number {
	if (!alignment || alignment.characterEndTimesSeconds.length === 0) {
		return 0;
	}

	const end = alignment.characterEndTimesSeconds[alignment.characterEndTimesSeconds.length - 1];
	return Number.isFinite(end) && end > 0 ? end : 0;
}

function parsePcmSampleRate(outputFormat: string): number | undefined {
	const match = outputFormat.match(/^pcm_(\d+)$/i);
	if (!match?.[1]) {
		return undefined;
	}

	const parsed = Number(match[1]);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return undefined;
	}

	return parsed;
}

function parseMp3Bitrate(outputFormat: string): number | undefined {
	const match = outputFormat.match(/^mp3_(\d+)_(\d+)$/i);
	if (!match?.[2]) {
		return undefined;
	}

	const bitrateKbps = Number(match[2]);
	if (!Number.isFinite(bitrateKbps) || bitrateKbps <= 0) {
		return undefined;
	}

	return bitrateKbps * 1000;
}

function estimateDurationFromAudioBuffer(audio: BinaryBuffer, outputFormat: string): number {
	const sampleRate = parsePcmSampleRate(outputFormat);
	if (sampleRate && sampleRate > 0) {
		return audio.length / (sampleRate * 2);
	}

	const bitrateBps = parseMp3Bitrate(outputFormat);
	if (bitrateBps && bitrateBps > 0) {
		return (audio.length * 8) / bitrateBps;
	}

	return 0;
}

function buildWavFromPcmMono16(pcm: BinaryBuffer, sampleRate: number): BinaryBuffer {
	const header = Buffer.alloc(44);
	const numChannels = 1;
	const bitsPerSample = 16;
	const blockAlign = (numChannels * bitsPerSample) / 8;
	const byteRate = sampleRate * blockAlign;
	const subchunk2Size = pcm.length;
	const chunkSize = 36 + subchunk2Size;

	header.write('RIFF', 0, 'ascii');
	header.writeUInt32LE(chunkSize, 4);
	header.write('WAVE', 8, 'ascii');
	header.write('fmt ', 12, 'ascii');
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(numChannels, 22);
	header.writeUInt32LE(sampleRate, 24);
	header.writeUInt32LE(byteRate, 28);
	header.writeUInt16LE(blockAlign, 32);
	header.writeUInt16LE(bitsPerSample, 34);
	header.write('data', 36, 'ascii');
	header.writeUInt32LE(subchunk2Size, 40);

	return Buffer.concat([header, pcm]);
}

function stripLeadingMp3Id3Tag(buffer: BinaryBuffer): BinaryBuffer {
	const input = buffer as BufferLike;
	if (input.length < 10) {
		return buffer;
	}

	if (input[0] !== 0x49 || input[1] !== 0x44 || input[2] !== 0x33) {
		return buffer;
	}

	const size =
		((input[6] & 0x7f) << 21) |
		((input[7] & 0x7f) << 14) |
		((input[8] & 0x7f) << 7) |
		(input[9] & 0x7f);
	const total = 10 + size;
	if (total >= input.length) {
		return buffer;
	}

	return input.slice(total);
}

function stitchAudioChunks(
	chunks: GeneratedChunk[],
	audioFormat: AudioFormat,
	outputFormat: string,
): BinaryBuffer {
	if (chunks.length === 0) {
		return Buffer.alloc(0);
	}

	if (chunks.length === 1) {
		if (audioFormat === 'wav') {
			const sampleRate = parsePcmSampleRate(outputFormat) ?? 44100;
			return buildWavFromPcmMono16(chunks[0].audio, sampleRate);
		}
		return chunks[0].audio;
	}

	if (audioFormat === 'wav') {
		const sampleRate = parsePcmSampleRate(outputFormat) ?? 44100;
		const joinedPcm = Buffer.concat(chunks.map((chunk) => chunk.audio));
		return buildWavFromPcmMono16(joinedPcm, sampleRate);
	}

	const processed = chunks.map((chunk, index) =>
		index === 0 ? chunk.audio : stripLeadingMp3Id3Tag(chunk.audio),
	);
	return Buffer.concat(processed);
}

function getAudioMimeType(audioFormat: AudioFormat): string {
	return audioFormat === 'wav' ? 'audio/wav' : 'audio/mpeg';
}

function getAudioExtension(audioFormat: AudioFormat): string {
	return audioFormat === 'wav' ? 'wav' : 'mp3';
}

function asCleanString(value: unknown): string {
	return String(value ?? '').trim();
}

function getModelLimitFromResponse(model: IDataObject): number | undefined {
	const candidates = [
		model.max_characters_request_subscribed_user,
		model.max_characters_request_free_user,
		model.max_characters,
	];

	for (const candidate of candidates) {
		const parsed = parsePositiveNumber(candidate);
		if (parsed) {
			return Math.trunc(parsed);
		}
	}

	return undefined;
}

async function resolveModelCharacterLimit(
	this: IExecuteFunctions,
	itemIndex: number,
	modelId: string,
	resolveFromApi: boolean,
	fallbackLimit: number,
): Promise<number> {
	if (!resolveFromApi) {
		return fallbackLimit;
	}

	const options: IHttpRequestOptions = {
		method: 'GET',
		url: 'https://api.elevenlabs.io/v1/models',
		json: true,
	};

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(this, 'elevenLabsApi', options);
		if (!Array.isArray(response)) {
			return fallbackLimit;
		}

		for (const rawModel of response) {
			if (!rawModel || typeof rawModel !== 'object' || Array.isArray(rawModel)) {
				continue;
			}

			const model = rawModel as IDataObject;
			const responseModelId = asCleanString(model.model_id ?? model.id);
			if (!responseModelId || responseModelId !== modelId) {
				continue;
			}

			const limit = getModelLimitFromResponse(model);
			if (limit && limit > 0) {
				return limit;
			}
		}
	} catch {
		return fallbackLimit;
	}

	return fallbackLimit;
}

function ensureElevenLabsCredentials(credentials: IDataObject): void {
	const apiKey = asCleanString(credentials.apiKey);
	if (!apiKey) {
		throw new Error('ElevenLabs API key is missing in credentials.');
	}
}

function ensureSpacesCredentials(credentials: IDataObject): SpacesCredentials {
	const accessKey = asCleanString(credentials.accessKey);
	const secretKey = asCleanString(credentials.secretKey);
	const region = asCleanString(credentials.region);

	if (!accessKey || !secretKey || !region) {
		throw new Error('DigitalOcean Spaces credentials require Region, Access Key, and Secret Key.');
	}

	return {
		accessKey,
		secretKey,
		region,
	};
}

interface ElevenLabsSynthesisOptions {
	voiceId: string;
	modelId: string;
	text: string;
	outputFormat: string;
	withTimestamps: boolean;
	voiceSettings: IDataObject;
}

async function synthesizeChunk(
	this: IExecuteFunctions,
	itemIndex: number,
	options: ElevenLabsSynthesisOptions,
): Promise<GeneratedChunk> {
	const endpoint = options.withTimestamps
		? `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(options.voiceId)}/with-timestamps`
		: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(options.voiceId)}`;

	const body: IDataObject = {
		text: options.text,
		model_id: options.modelId,
		voice_settings: options.voiceSettings,
	};

	const requestOptions: IHttpRequestOptions = {
		method: 'POST',
		url: endpoint,
		qs: {
			output_format: options.outputFormat,
		},
		body,
	};

	if (options.withTimestamps) {
		requestOptions.json = true;
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'elevenLabsApi',
			requestOptions,
		);
		if (!response || typeof response !== 'object' || Array.isArray(response)) {
			throw new Error('Unexpected response while generating ElevenLabs timestamps audio.');
		}

		const data = response as IDataObject;
		const audioBase64 = asCleanString(data.audio_base64);
		if (!audioBase64) {
			throw new Error('ElevenLabs response is missing audio_base64.');
		}

		const audio = Buffer.from(audioBase64, 'base64');
		const alignment =
			parseAlignment(data.normalized_alignment) ??
			parseAlignment(data.alignment);
		const alignmentDuration = durationFromAlignment(alignment);
		const estimatedDuration = estimateDurationFromAudioBuffer(audio, options.outputFormat);
		const durationSeconds = alignmentDuration > 0 ? alignmentDuration : estimatedDuration;
		const durationSource: GeneratedChunk['durationSource'] =
			alignmentDuration > 0 ? 'alignment' : estimatedDuration > 0 ? 'estimated' : 'unknown';

		return {
			text: options.text,
			audio,
			alignment,
			durationSeconds,
			durationSource,
		};
	}

	requestOptions.json = false;
	requestOptions.encoding = 'arraybuffer';
	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'elevenLabsApi', requestOptions);
	const audio = toBuffer(response);
	const durationSeconds = estimateDurationFromAudioBuffer(audio, options.outputFormat);
	const durationSource: GeneratedChunk['durationSource'] = durationSeconds > 0 ? 'estimated' : 'unknown';

	return {
		text: options.text,
		audio,
		durationSeconds,
		durationSource,
	};
}

interface RecursiveSynthesisConfig {
	maxDepth: number;
	minSplitLength: number;
	options: Omit<ElevenLabsSynthesisOptions, 'text'>;
}

async function synthesizeChunkWithAutoSplit(
	this: IExecuteFunctions,
	itemIndex: number,
	text: string,
	config: RecursiveSynthesisConfig,
	depth = 0,
): Promise<GeneratedChunk[]> {
	try {
		const synthesized = await synthesizeChunk.call(this, itemIndex, {
			...config.options,
			text,
		});
		return [synthesized];
	} catch (error) {
		const shouldSplit = isChunkLengthError(error) && text.length > config.minSplitLength && depth < config.maxDepth;
		if (!shouldSplit) {
			throw error;
		}

		const split = splitAtNaturalBoundary(text);
		if (!split) {
			throw error;
		}

		const [left, right] = split;
		const leftResult = await synthesizeChunkWithAutoSplit.call(this, itemIndex, left, config, depth + 1);
		const rightResult = await synthesizeChunkWithAutoSplit.call(this, itemIndex, right, config, depth + 1);
		return [...leftResult, ...rightResult];
	}
}

async function synthesizeChunkWithRetries(
	this: IExecuteFunctions,
	itemIndex: number,
	text: string,
	recursiveConfig: RecursiveSynthesisConfig,
	retryConfig: RetryConfig,
	retryStats: RetryStats,
): Promise<GeneratedChunk[]> {
	let attempt = 0;
	while (true) {
		try {
			return await synthesizeChunkWithAutoSplit.call(this, itemIndex, text, recursiveConfig);
		} catch (error) {
			const statusCode = getStatusCode(error);
			const retriable = statusCode !== undefined && [429, 500, 502, 503, 504].includes(statusCode);
			if (!retriable || attempt >= retryConfig.maxRetries) {
				throw error;
			}

			const retryAfterMs = parseRetryAfterMs(error);
			const delayMs = computeBackoffDelayMs(attempt, retryConfig, retryAfterMs);
			retryStats.retryEvents += 1;
			retryStats.maxDelayMs = Math.max(retryStats.maxDelayMs, delayMs);
			await waitForDelayMs(delayMs);
			attempt += 1;
		}
	}
}

async function synthesizeChunksWithConcurrency(
	this: IExecuteFunctions,
	itemIndex: number,
	chunks: string[],
	maxChunkConcurrency: number,
	recursiveConfig: RecursiveSynthesisConfig,
	retryConfig: RetryConfig,
	retryStats: RetryStats,
): Promise<GeneratedChunk[]> {
	if (chunks.length === 0) {
		return [];
	}

	const orderedResults: Array<GeneratedChunk[] | undefined> = new Array(chunks.length);
	let nextTaskIndex = 0;
	const workerCount = Math.max(1, Math.min(maxChunkConcurrency, chunks.length));

	const worker = async (): Promise<void> => {
		while (true) {
			const currentIndex = nextTaskIndex;
			nextTaskIndex += 1;
			if (currentIndex >= chunks.length) {
				return;
			}

			const chunkText = chunks[currentIndex];
			const result = await synthesizeChunkWithRetries.call(
				this,
				itemIndex,
				chunkText,
				recursiveConfig,
				retryConfig,
				retryStats,
			);
			orderedResults[currentIndex] = result;
		}
	};

	await Promise.all(Array.from({ length: workerCount }, async () => worker()));

	const generatedChunks: GeneratedChunk[] = [];
	for (let index = 0; index < orderedResults.length; index++) {
		const entry = orderedResults[index];
		if (!entry) {
			throw new NodeOperationError(this.getNode(), `Missing synthesized chunk result for index ${index}.`, {
				itemIndex,
			});
		}

		generatedChunks.push(...entry);
	}

	return generatedChunks;
}

function sha256Hex(input: string | BinaryBuffer): string {
	return String(createHash('sha256').update(input).digest('hex'));
}

function hmacSha256(key: string | BinaryBuffer, value: string): BinaryBuffer {
	return createHmac('sha256', key).update(value).digest() as BinaryBuffer;
}

function getSigningKey(secretKey: string, dateStamp: string, region: string): BinaryBuffer {
	const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
	const kRegion = hmacSha256(kDate, region);
	const kService = hmacSha256(kRegion, 's3');
	return hmacSha256(kService, 'aws4_request');
}

function encodeRfc3986(value: string): string {
	return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
		`%${char.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

function encodeObjectKey(key: string): string {
	return key
		.split('/')
		.map((segment) => encodeRfc3986(segment))
		.join('/');
}

function buildSpacesPublicUrl(region: string, bucket: string, key: string): string {
	const encodedKey = encodeObjectKey(key);
	return `https://${bucket}.${region}.digitaloceanspaces.com/${encodedKey}`;
}

async function uploadObjectToSpaces(
	this: IExecuteFunctions,
	itemIndex: number,
	credentials: SpacesCredentials,
	bucket: string,
	key: string,
	body: BinaryBuffer,
	contentType: string,
	makePublic: boolean,
): Promise<string> {
	const cleanBucket = bucket.trim();
	const cleanKey = key.trim().replace(/^\/+/, '');
	if (!cleanBucket || !cleanKey) {
		throw new NodeOperationError(this.getNode(), 'Spaces upload requires bucket and object key.', {
			itemIndex,
		});
	}

	const host = `${cleanBucket}.${credentials.region}.digitaloceanspaces.com`;
	const encodedKey = encodeObjectKey(cleanKey);
	const canonicalUri = `/${encodedKey}`;
	const url = `https://${host}${canonicalUri}`;

	const amzTimestamp = formatUtcTimestamp(new Date());
	const dateStamp = formatDatestamp(amzTimestamp);
	const payloadHash = sha256Hex(body);
	const credentialScope = `${dateStamp}/${credentials.region}/s3/aws4_request`;

	const headers: Record<string, string> = {
		'content-type': contentType,
		host,
		'x-amz-content-sha256': payloadHash,
		'x-amz-date': amzTimestamp,
	};
	if (makePublic) {
		headers['x-amz-acl'] = 'public-read';
	}

	const sortedHeaderEntries = Object.entries(headers)
		.map(([keyName, value]) => [keyName.toLowerCase(), value.trim().replace(/\s+/g, ' ')] as const)
		.sort(([a], [b]) => a.localeCompare(b));
	const canonicalHeaders = sortedHeaderEntries.map(([keyName, value]) => `${keyName}:${value}\n`).join('');
	const signedHeaders = sortedHeaderEntries.map(([keyName]) => keyName).join(';');

	const canonicalRequest = [
		'PUT',
		canonicalUri,
		'',
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	].join('\n');

	const stringToSign = [
		'AWS4-HMAC-SHA256',
		amzTimestamp,
		credentialScope,
		sha256Hex(canonicalRequest),
	].join('\n');

	const signingKey = getSigningKey(credentials.secretKey, dateStamp, credentials.region);
	const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
	const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

	const requestHeaders: IDataObject = {
		...headers,
		Authorization: authorization,
	};

	const requestOptions: IHttpRequestOptions = {
		method: 'PUT',
		url,
		body,
		headers: requestHeaders,
		json: false,
		returnFullResponse: true,
	};

	try {
		await this.helpers.httpRequest(requestOptions);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			itemIndex,
			message:
				'DigitalOcean Spaces upload failed. Verify region, bucket, access key, secret key, and permissions.',
		});
	}

	return buildSpacesPublicUrl(credentials.region, cleanBucket, cleanKey);
}

function normalizeFolderPath(input: string): string {
	const trimmed = input.trim().replace(/\\/g, '/');
	const normalized = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
	return normalized;
}

function buildObjectKey(folderPath: string, fileName: string): string {
	const folder = normalizeFolderPath(folderPath);
	if (!folder) {
		return fileName;
	}
	return `${folder}/${fileName}`;
}

function combineAlignment(chunks: GeneratedChunk[]): ElevenLabsAlignment | undefined {
	const characters: string[] = [];
	const starts: number[] = [];
	const ends: number[] = [];
	let offset = 0;

	for (const chunk of chunks) {
		const alignment = chunk.alignment;
		if (!alignment) {
			offset += chunk.durationSeconds;
			continue;
		}

		for (let index = 0; index < alignment.characters.length; index++) {
			characters.push(alignment.characters[index]);
			starts.push(alignment.characterStartTimesSeconds[index] + offset);
			ends.push(alignment.characterEndTimesSeconds[index] + offset);
		}

		const maxEnd = alignment.characterEndTimesSeconds[alignment.characterEndTimesSeconds.length - 1] ?? 0;
		const alignmentDuration = Number.isFinite(maxEnd) ? Math.max(0, maxEnd) : 0;
		const durationToAdd = chunk.durationSeconds > 0 ? chunk.durationSeconds : alignmentDuration;
		offset += durationToAdd;
	}

	if (characters.length === 0) {
		return undefined;
	}

	return {
		characters,
		characterStartTimesSeconds: starts,
		characterEndTimesSeconds: ends,
	};
}

function buildTranscriptText(chunks: GeneratedChunk[]): string {
	const parts = chunks
		.map((chunk) => {
			if (chunk.alignment && chunk.alignment.characters.length > 0) {
				return chunk.alignment.characters.join('');
			}
			return chunk.text;
		})
		.map((text) => text.trim())
		.filter((text) => text.length > 0);

	return parts.join('\n\n').trim();
}

export const description: INodeProperties[] = [
	{
		displayName: 'Cleaned Text',
		name: 'cleanedText',
		type: 'string',
		typeOptions: {
			rows: 8,
		},
		default: '',
		required: true,
		displayOptions,
		description: 'Cleaned TTS text to synthesize (for example from Prepare for TTS output)',
	},
	{
		displayName: 'Voice ID',
		name: 'voiceId',
		type: 'string',
		default: '',
		required: true,
		displayOptions,
		description: 'ElevenLabs voice ID',
	},
	{
		displayName: 'Model ID',
		name: 'modelId',
		type: 'string',
		default: 'eleven_multilingual_v2',
		required: true,
		displayOptions,
		description: 'ElevenLabs model ID. This field is free-text to stay compatible with new model releases.',
	},
	{
		displayName: 'Audio Format',
		name: 'audioFormat',
		type: 'options',
		default: 'mp3',
		displayOptions,
		options: [
			{
				name: 'MP3',
				value: 'mp3',
			},
			{
				name: 'WAV',
				value: 'wav',
			},
		],
		description: 'Final output format. WAV uses PCM generation for deterministic stitching.',
	},
	{
		displayName: 'Generate Transcript',
		name: 'generateTranscript',
		type: 'boolean',
		default: true,
		displayOptions,
		description: 'Whether to request alignment/timestamps and build transcript artifacts',
	},
	{
		displayName: 'Transcript Output',
		name: 'transcriptOutput',
		type: 'options',
		default: 'textAndAlignmentJson',
		displayOptions: transcriptDisplayOptions,
		options: [
			{
				name: 'Alignment JSON Only',
				value: 'alignmentJsonOnly',
			},
			{
				name: 'Text and Alignment JSON',
				value: 'textAndAlignmentJson',
			},
			{
				name: 'Text Only',
				value: 'textOnly',
			},
		],
		description: 'Which transcript artifacts to create',
	},
	{
		displayName: 'Chunk Strategy',
		name: 'chunkStrategy',
		type: 'options',
		default: 'paragraphAware',
		displayOptions,
		options: [
			{
				name: 'Paragraph Aware',
				value: 'paragraphAware',
			},
			{
				name: 'Sentence Aware',
				value: 'sentenceAware',
			},
		],
		description: 'How to split text before sending chunks to ElevenLabs',
	},
	{
		displayName: 'Performance Options',
		name: 'performanceOptions',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		displayOptions,
		options: [
			{
				displayName: 'Max Chunk Concurrency',
				name: 'maxChunkConcurrency',
				type: 'number',
				default: 3,
				typeOptions: {
					maxValue: 10,
					minValue: 1,
				},
				description: 'Maximum number of chunk synthesis requests processed in parallel',
			},
		],
	},
	{
		displayName: 'Model Limit Options',
		name: 'modelOptions',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		displayOptions,
		options: [
			{
				displayName: 'Fallback Character Limit',
				name: 'fallbackCharacterLimit',
				type: 'number',
				default: 5000,
				typeOptions: {
					minValue: 500,
				},
					description: 'Used if model metadata lookup fails or model is not returned by ElevenLabs',
			},
			{
				displayName: 'Max Characters Override',
				name: 'maxCharactersOverride',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
				},
					description: 'Optional hard override. Set above 0 to skip auto limit computation.',
				},
				{
					displayName: 'Resolve Model Limit From API',
					name: 'resolveModelLimitFromApi',
					type: 'boolean',
					default: true,
					description: 'Whether to query ElevenLabs model metadata and infer max characters dynamically',
				},
			{
				displayName: 'Safety Margin',
				name: 'safetyMargin',
				type: 'number',
				default: 150,
				typeOptions: {
					minValue: 0,
				},
					description: 'Characters reserved below the discovered model limit to reduce boundary failures',
			},
		],
	},
	{
		displayName: 'Voice Settings',
		name: 'voiceSettings',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		displayOptions,
		options: [
			{
				displayName: 'Similarity Boost',
				name: 'similarityBoost',
				type: 'number',
				default: 0.75,
				typeOptions: {
					maxValue: 1,
					minValue: 0,
				},
			},
			{
				displayName: 'Stability',
				name: 'stability',
				type: 'number',
				default: 0.5,
				typeOptions: {
					maxValue: 1,
					minValue: 0,
				},
			},
			{
				displayName: 'Style',
				name: 'style',
				type: 'number',
				default: 0,
				typeOptions: {
					maxValue: 1,
					minValue: 0,
				},
			},
			{
				displayName: 'Use Speaker Boost',
				name: 'useSpeakerBoost',
				type: 'boolean',
				default: true,
			},
		],
	},
	{
		displayName: 'Retry Options',
		name: 'retryOptions',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		displayOptions,
		options: [
			{
				displayName: 'Max Retries per Chunk',
				name: 'maxRetries',
				type: 'number',
				default: 2,
				typeOptions: {
					minValue: 0,
				},
				description: 'Retries for transient request errors (429/5xx)',
			},
			{
				displayName: 'Retry Base Delay (MS)',
				name: 'retryBaseDelayMs',
				type: 'number',
				default: 500,
				typeOptions: {
					minValue: 100,
				},
				description: 'Base delay used for exponential backoff between retries',
			},
			{
				displayName: 'Retry Jitter Ratio',
				name: 'retryJitterRatio',
				type: 'number',
				default: 0.2,
				typeOptions: {
					maxValue: 1,
					minValue: 0,
				},
				description: 'Random jitter ratio applied to each retry delay',
			},
			{
				displayName: 'Retry Max Delay (MS)',
				name: 'retryMaxDelayMs',
				type: 'number',
				default: 10000,
				typeOptions: {
					minValue: 1000,
				},
				description: 'Maximum retry delay cap for exponential backoff',
			},
			{
				displayName: 'Split Retry Depth',
				name: 'splitRetryDepth',
				type: 'number',
				default: 5,
				typeOptions: {
					minValue: 1,
				},
					description: 'Maximum recursive split depth when ElevenLabs rejects chunk length',
				},
		],
	},
	{
		displayName: 'Sync Guardrails',
		name: 'syncGuardrails',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		displayOptions,
		options: [
			{
				displayName: 'Strict Sync Recommended Format',
				name: 'strictSyncRecommendedFormat',
				type: 'options',
				default: 'wav',
				options: [
					{
						name: 'MP3',
						value: 'mp3',
					},
					{
						name: 'WAV',
						value: 'wav',
					},
				],
				description: 'Informational recommendation included in output warnings when sync risk is detected',
			},
			{
				displayName: 'Warn on MP3 Sync Risk',
				name: 'warnOnMp3SyncRisk',
				type: 'boolean',
				default: true,
				description: 'Whether to emit warnings when transcript mode is used with MP3 output',
			},
		],
	},
	{
		displayName: 'Include Binary Data',
		name: 'includeBinaryData',
		type: 'boolean',
		default: true,
		displayOptions,
		description: 'Whether to return generated audio/transcript files as n8n binary output',
	},
	{
		displayName: 'Audio Binary Field Name',
		name: 'audioBinaryFieldName',
		type: 'string',
		default: 'audio',
		required: true,
		displayOptions: binaryDisplayOptions,
		description: 'Output field name for audio binary data',
	},
	{
		displayName: 'Transcript Binary Field Base Name',
		name: 'transcriptBinaryFieldName',
		type: 'string',
		default: 'transcript',
		required: true,
		displayOptions: binaryTranscriptDisplayOptions,
		description: 'Base name used for transcript binaries (for example transcriptText / transcriptAlignment)',
	},
	{
		displayName: 'Spaces Options',
		name: 'spacesOptions',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		displayOptions: spacesDisplayOptions,
		options: [
			{
				displayName: 'Bucket Name',
				name: 'bucketName',
				type: 'string',
				default: '',
			},
			{
				displayName: 'File Name Stem',
				name: 'fileNameStem',
				type: 'string',
				default: '',
				description: 'Optional base file name without extension. Auto-generated if empty.',
			},
			{
				displayName: 'Folder Path',
				name: 'folderPath',
				type: 'string',
				default: 'audio',
				description: 'Optional folder prefix inside the bucket',
			},
			{
				displayName: 'Make Public',
				name: 'makePublic',
				type: 'boolean',
				default: true,
				description: 'Whether to upload with public-read ACL',
			},
			{
				displayName: 'Upload Transcript Artifacts',
				name: 'uploadTranscriptArtifacts',
				type: 'boolean',
				default: true,
				description: 'Whether to upload transcript files in addition to audio',
			},
		],
	},
	{
		displayName: 'Include Chunk Diagnostics',
		name: 'includeChunkDiagnostics',
		type: 'boolean',
		default: true,
		displayOptions,
		description: 'Whether to include chunk-level stats in JSON output',
	},
	{
		displayName: 'Include Full Alignment in JSON',
		name: 'includeFullAlignmentInJson',
		type: 'boolean',
		default: false,
		displayOptions: transcriptDisplayOptions,
		description: 'Whether to include the full merged alignment object directly in JSON output',
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const cleanedTextInput = this.getNodeParameter('cleanedText', itemIndex) as string;
	const voiceId = asCleanString(this.getNodeParameter('voiceId', itemIndex));
	const modelId = asCleanString(this.getNodeParameter('modelId', itemIndex));
	const audioFormat = this.getNodeParameter('audioFormat', itemIndex) as AudioFormat;
	const chunkStrategy = this.getNodeParameter('chunkStrategy', itemIndex) as TtsChunkStrategy;
	const generateTranscript = this.getNodeParameter('generateTranscript', itemIndex, true) as boolean;
	const transcriptOutput = this.getNodeParameter(
		'transcriptOutput',
		itemIndex,
		'textAndAlignmentJson',
	) as TranscriptOutputMode;
	const includeBinaryData = this.getNodeParameter('includeBinaryData', itemIndex, true) as boolean;
	const includeChunkDiagnostics = this.getNodeParameter('includeChunkDiagnostics', itemIndex, true) as boolean;
	const includeFullAlignmentInJson = this.getNodeParameter('includeFullAlignmentInJson', itemIndex, false) as boolean;
	const operation = this.getNodeParameter('operation', itemIndex) as string;
	const uploadToSpaces = operation === 'generateTtsAudioWithSpacesUpload';
	const transcriptOutputIncludesText =
		generateTranscript && (transcriptOutput === 'textOnly' || transcriptOutput === 'textAndAlignmentJson');
	const transcriptOutputIncludesAlignment =
		generateTranscript &&
		(transcriptOutput === 'alignmentJsonOnly' || transcriptOutput === 'textAndAlignmentJson');

	const audioBinaryFieldName = asCleanString(this.getNodeParameter('audioBinaryFieldName', itemIndex, 'audio'));
	const transcriptBinaryFieldName = asCleanString(
		this.getNodeParameter('transcriptBinaryFieldName', itemIndex, 'transcript'),
	);

	const cleanedText = cleanedTextInput.trim();
	if (!cleanedText) {
		throw new NodeOperationError(this.getNode(), 'Cleaned Text is required.', { itemIndex });
	}
	if (!voiceId) {
		throw new NodeOperationError(this.getNode(), 'Voice ID is required.', { itemIndex });
	}
	if (!modelId) {
		throw new NodeOperationError(this.getNode(), 'Model ID is required.', { itemIndex });
	}
	if (includeBinaryData && !audioBinaryFieldName) {
		throw new NodeOperationError(this.getNode(), 'Audio Binary Field Name is required.', { itemIndex });
	}
	if (includeBinaryData && generateTranscript && !transcriptBinaryFieldName) {
		throw new NodeOperationError(this.getNode(), 'Transcript Binary Field Base Name is required.', {
			itemIndex,
		});
	}

	let elevenLabsCredentials: IDataObject;
	try {
		elevenLabsCredentials = await this.getCredentials('elevenLabsApi', itemIndex);
	} catch {
		throw new NodeOperationError(
			this.getNode(),
			'ElevenLabs credentials are required for this operation. Add an ElevenLabs API credential.',
			{ itemIndex },
		);
	}

	try {
		ensureElevenLabsCredentials(elevenLabsCredentials);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}

	const modelOptions = this.getNodeParameter('modelOptions', itemIndex, {}) as IDataObject;
	const maxCharactersOverride = Math.trunc(Number(modelOptions.maxCharactersOverride ?? 0));
	const safetyMargin = Math.max(0, Math.trunc(Number(modelOptions.safetyMargin ?? 150)));
	const resolveModelLimitFromApi =
		modelOptions.resolveModelLimitFromApi === undefined ? true : Boolean(modelOptions.resolveModelLimitFromApi);
	const fallbackCharacterLimit =
		Math.trunc(
			Number(
				modelOptions.fallbackCharacterLimit ??
					FALLBACK_MODEL_CHAR_LIMITS[modelId] ??
					5000,
			),
		) || 5000;

	const resolvedModelLimit =
		maxCharactersOverride > 0
			? maxCharactersOverride
			: await resolveModelCharacterLimit.call(
					this,
					itemIndex,
					modelId,
					resolveModelLimitFromApi,
					fallbackCharacterLimit,
				);

	const effectiveChunkLength = Math.max(200, resolvedModelLimit - safetyMargin);
	const initialChunks = chunkTtsText(cleanedText, effectiveChunkLength, chunkStrategy).filter(
		(chunk) => chunk.trim().length > 0,
	);
	if (initialChunks.length === 0) {
		throw new NodeOperationError(this.getNode(), 'No text chunks were produced for synthesis.', {
			itemIndex,
		});
	}

	const voiceSettingsInput = this.getNodeParameter('voiceSettings', itemIndex, {}) as IDataObject;
	const voiceSettings: IDataObject = {
		similarity_boost:
			voiceSettingsInput.similarityBoost === undefined ? 0.75 : Number(voiceSettingsInput.similarityBoost),
		stability: voiceSettingsInput.stability === undefined ? 0.5 : Number(voiceSettingsInput.stability),
		style: voiceSettingsInput.style === undefined ? 0 : Number(voiceSettingsInput.style),
		use_speaker_boost:
			voiceSettingsInput.useSpeakerBoost === undefined ? true : Boolean(voiceSettingsInput.useSpeakerBoost),
	};

	const performanceOptions = this.getNodeParameter('performanceOptions', itemIndex, {}) as IDataObject;
	const maxChunkConcurrency = Math.max(1, Math.trunc(Number(performanceOptions.maxChunkConcurrency ?? 3)));

	const retryOptions = this.getNodeParameter('retryOptions', itemIndex, {}) as IDataObject;
	const retryConfig: RetryConfig = {
		maxRetries: Math.max(0, Math.trunc(Number(retryOptions.maxRetries ?? 2))),
		retryBaseDelayMs: Math.max(100, Math.trunc(Number(retryOptions.retryBaseDelayMs ?? 500))),
		retryJitterRatio: Math.max(0, Math.min(1, Number(retryOptions.retryJitterRatio ?? 0.2))),
		retryMaxDelayMs: Math.max(1000, Math.trunc(Number(retryOptions.retryMaxDelayMs ?? 10000))),
	};
	const splitRetryDepth = Math.max(1, Math.trunc(Number(retryOptions.splitRetryDepth ?? 5)));

	const syncGuardrails = this.getNodeParameter('syncGuardrails', itemIndex, {}) as IDataObject;
	const warnOnMp3SyncRisk =
		syncGuardrails.warnOnMp3SyncRisk === undefined ? true : Boolean(syncGuardrails.warnOnMp3SyncRisk);
	const strictSyncRecommendedFormat = (asCleanString(syncGuardrails.strictSyncRecommendedFormat) || 'wav')
		.toLowerCase();
	const warnings: string[] = [];

	const outputFormat = getElevenLabsOutputFormat(audioFormat);
	const recursiveConfig: RecursiveSynthesisConfig = {
		maxDepth: splitRetryDepth,
		minSplitLength: 300,
		options: {
			voiceId,
			modelId,
			outputFormat,
			withTimestamps: generateTranscript,
			voiceSettings,
		},
	};
	const retryStats: RetryStats = {
		maxDelayMs: 0,
		retryEvents: 0,
	};

	let generatedChunks: GeneratedChunk[] = [];
	try {
		generatedChunks = await synthesizeChunksWithConcurrency.call(
			this,
			itemIndex,
			initialChunks,
			maxChunkConcurrency,
			recursiveConfig,
			retryConfig,
			retryStats,
		);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	if (generatedChunks.length === 0) {
		throw new NodeOperationError(this.getNode(), 'ElevenLabs returned no synthesized chunks.', { itemIndex });
	}

	const alignmentFallbackChunks = generatedChunks.filter((chunk) => chunk.durationSource === 'estimated').length;
	const unknownDurationChunks = generatedChunks.filter(
		(chunk) => chunk.durationSource === 'unknown' && !chunk.alignment,
	).length;
	if (generateTranscript && unknownDurationChunks > 0 && transcriptOutputIncludesAlignment) {
		throw new NodeOperationError(
			this.getNode(),
			`Could not estimate audio duration for ${unknownDurationChunks} chunk(s), so transcript alignment could not be synchronized reliably.`,
			{ itemIndex },
		);
	}
	if (alignmentFallbackChunks > 0) {
		warnings.push(
			`Estimated duration fallback was used for ${alignmentFallbackChunks} chunk(s) where alignment timestamps were unavailable.`,
		);
	}
	if (unknownDurationChunks > 0) {
		warnings.push(
			`${unknownDurationChunks} chunk(s) had unknown duration and may reduce transcript synchronization precision.`,
		);
	}
	if (generateTranscript && audioFormat === 'mp3' && warnOnMp3SyncRisk) {
		warnings.push(
			'MP3 chunk stitching can introduce boundary drift. Use WAV output when strict transcript synchronization is required.',
		);
	}

	const audioBuffer = stitchAudioChunks(generatedChunks, audioFormat, outputFormat);
	const audioMimeType = getAudioMimeType(audioFormat);
	const transcriptText = generateTranscript ? buildTranscriptText(generatedChunks) : '';
	const mergedAlignment = generateTranscript ? combineAlignment(generatedChunks) : undefined;

	const autoStem = generateFileStem(cleanedText);
	let fileStem = autoStem;
	let spacesBucket = '';
	let spacesFolder = 'audio';
	let spacesMakePublic = true;
	let spacesUploadTranscriptArtifacts = true;
	let spacesCredentials: SpacesCredentials | undefined;

	if (uploadToSpaces) {
		const spacesOptions = this.getNodeParameter('spacesOptions', itemIndex, {}) as IDataObject;
		spacesBucket = asCleanString(spacesOptions.bucketName);
		if (!spacesBucket) {
			throw new NodeOperationError(
				this.getNode(),
				'Spaces bucket name is required for Generate TTS Audio + Spaces Upload.',
				{ itemIndex },
			);
		}

		spacesFolder = asCleanString(spacesOptions.folderPath ?? 'audio') || 'audio';
		spacesMakePublic = spacesOptions.makePublic === undefined ? true : Boolean(spacesOptions.makePublic);
		spacesUploadTranscriptArtifacts =
			spacesOptions.uploadTranscriptArtifacts === undefined
				? true
				: Boolean(spacesOptions.uploadTranscriptArtifacts);

		const inputStem = normalizeFileStem(asCleanString(spacesOptions.fileNameStem));
		if (inputStem) {
			fileStem = inputStem;
		}

		try {
			const rawSpacesCredentials = await this.getCredentials('digitalOceanSpacesApi', itemIndex);
			spacesCredentials = ensureSpacesCredentials(rawSpacesCredentials);
		} catch {
			throw new NodeOperationError(
				this.getNode(),
				'DigitalOcean Spaces credentials are required for Generate TTS Audio + Spaces Upload.',
				{ itemIndex },
			);
		}
	}

	const audioExtension = getAudioExtension(audioFormat);
	const audioFileName = `${fileStem}.${audioExtension}`;
	const audioObjectKey = buildObjectKey(spacesFolder, audioFileName);

	let transcriptTextFileName: string | undefined;
	let transcriptAlignmentFileName: string | undefined;
	let transcriptAlignmentJson = '';

	if (transcriptOutputIncludesText) {
		transcriptTextFileName = `${fileStem}.txt`;
	}

	if (transcriptOutputIncludesAlignment) {
		const alignmentPayload: IDataObject = {
			characters: mergedAlignment?.characters ?? [],
			character_start_times_seconds: mergedAlignment?.characterStartTimesSeconds ?? [],
			character_end_times_seconds: mergedAlignment?.characterEndTimesSeconds ?? [],
		};
		transcriptAlignmentJson = JSON.stringify(alignmentPayload, null, 2);
		transcriptAlignmentFileName = `${fileStem}.json`;
	}

	let audioUrl: string | undefined;
	let transcriptTextUrl: string | undefined;
	let transcriptAlignmentUrl: string | undefined;

	if (uploadToSpaces && spacesCredentials) {
		audioUrl = await uploadObjectToSpaces.call(
			this,
			itemIndex,
			spacesCredentials,
			spacesBucket,
			audioObjectKey,
			audioBuffer,
			audioMimeType,
			spacesMakePublic,
		);

		if (spacesUploadTranscriptArtifacts) {
			if (transcriptOutputIncludesText && transcriptTextFileName) {
				const key = buildObjectKey(spacesFolder, transcriptTextFileName);
				transcriptTextUrl = await uploadObjectToSpaces.call(
					this,
					itemIndex,
					spacesCredentials,
					spacesBucket,
					key,
					Buffer.from(transcriptText, 'utf-8'),
					'text/plain; charset=utf-8',
					spacesMakePublic,
				);
			}

			if (transcriptOutputIncludesAlignment && transcriptAlignmentFileName && transcriptAlignmentJson) {
				const key = buildObjectKey(spacesFolder, transcriptAlignmentFileName);
				transcriptAlignmentUrl = await uploadObjectToSpaces.call(
					this,
					itemIndex,
					spacesCredentials,
					spacesBucket,
					key,
					Buffer.from(transcriptAlignmentJson, 'utf-8'),
					'application/json; charset=utf-8',
					spacesMakePublic,
				);
			}
		}
	}

	const result: IDataObject = {
		audio_file_name: audioFileName,
		audio_format: audioFormat,
		audio_mime_type: audioMimeType,
		alignment_fallback_chunks: alignmentFallbackChunks,
		alignment_fallback_method: alignmentFallbackChunks > 0 ? 'audio_duration_estimate' : 'none',
		cleaned_text_length: cleanedText.length,
		effective_chunk_length: effectiveChunkLength,
		generated_chunk_count: generatedChunks.length,
		initial_chunk_count: initialChunks.length,
		max_chunk_concurrency_used: Math.max(1, Math.min(maxChunkConcurrency, initialChunks.length)),
		model_id: modelId,
		model_limit_resolved: resolvedModelLimit,
		output_format: outputFormat,
		retry_max_delay_ms_applied: retryStats.maxDelayMs,
		retry_strategy: 'exponential_jitter',
		retry_total_events: retryStats.retryEvents,
		used_model_limit_api: resolveModelLimitFromApi,
		voice_id: voiceId,
	};

	if (includeChunkDiagnostics) {
		result.chunk_diagnostics = generatedChunks.map((chunk, index) => ({
			index: index + 1,
			character_length: chunk.text.length,
			audio_bytes: chunk.audio.length,
		}));
	}

	if (generateTranscript) {
		result.transcript_enabled = true;
		if (transcriptOutputIncludesText) {
			result.transcript_text = transcriptText;
		}
		if (transcriptOutputIncludesAlignment) {
			result.transcript_alignment_available = Boolean(mergedAlignment);
		}
		if (includeFullAlignmentInJson && mergedAlignment) {
			result.transcript_alignment = {
				characters: mergedAlignment.characters,
				character_start_times_seconds: mergedAlignment.characterStartTimesSeconds,
				character_end_times_seconds: mergedAlignment.characterEndTimesSeconds,
			};
		}
	} else {
		result.transcript_enabled = false;
	}

	if (generateTranscript && audioFormat === 'mp3' && warnOnMp3SyncRisk) {
		result.strict_sync_recommendation =
			strictSyncRecommendedFormat === 'mp3'
				? 'mp3'
				: 'wav';
	}
	if (warnings.length > 0) {
		result.warnings = warnings;
	}

	if (audioUrl) {
		result.audio_url = audioUrl;
	}
	if (transcriptTextUrl) {
		result.transcript_text_url = transcriptTextUrl;
	}
	if (transcriptAlignmentUrl) {
		result.transcript_alignment_url = transcriptAlignmentUrl;
	}

	const outputItem: INodeExecutionData = {
		json: result,
		pairedItem: { item: itemIndex },
	};

	if (!includeBinaryData) {
		return [outputItem];
	}

	const binary: IBinaryKeyData = {};
	binary[audioBinaryFieldName] = await this.helpers.prepareBinaryData(audioBuffer, audioFileName, audioMimeType);

	if (generateTranscript) {
		if (transcriptOutputIncludesText && transcriptTextFileName) {
			const binaryName =
				transcriptOutput === 'textOnly' ? transcriptBinaryFieldName : `${transcriptBinaryFieldName}Text`;
			binary[binaryName] = await this.helpers.prepareBinaryData(
				Buffer.from(transcriptText, 'utf-8'),
				transcriptTextFileName,
				'text/plain',
			);
		}

		if (transcriptOutputIncludesAlignment && transcriptAlignmentFileName && transcriptAlignmentJson) {
			const binaryName =
				transcriptOutput === 'alignmentJsonOnly'
					? transcriptBinaryFieldName
					: `${transcriptBinaryFieldName}Alignment`;
			binary[binaryName] = await this.helpers.prepareBinaryData(
				Buffer.from(transcriptAlignmentJson, 'utf-8'),
				transcriptAlignmentFileName,
				'application/json',
			);
		}
	}

	outputItem.binary = binary;
	return [outputItem];
}

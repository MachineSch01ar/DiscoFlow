import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { discourseApiRequest } from '../../transport';
import { getPostId } from '../utils';

const TOPIC_URL_WITH_POST_NUMBER_REGEX = /\/t\/(?:[^/]+\/)?(\d+)\/(\d+)(?:[/?#]|$)/i;
const TOPIC_URL_HASH_POST_NUMBER_REGEX = /\/t\/(?:[^/]+\/)?(\d+)(?:[/?#]|$).*#post_(\d+)/i;

interface TopicPostReference {
	topicId: number;
	postNumber: number;
}

export function parseTopicPostReference(value: string): TopicPostReference | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	const urlMatch = trimmed.match(TOPIC_URL_WITH_POST_NUMBER_REGEX);
	if (urlMatch?.[1] && urlMatch[2]) {
		return {
			topicId: Number(urlMatch[1]),
			postNumber: Number(urlMatch[2]),
		};
	}

	const hashMatch = trimmed.match(TOPIC_URL_HASH_POST_NUMBER_REGEX);
	if (hashMatch?.[1] && hashMatch[2]) {
		return {
			topicId: Number(hashMatch[1]),
			postNumber: Number(hashMatch[2]),
		};
	}

	return null;
}

export function getTopicPostReferenceFromLocator(input: unknown): TopicPostReference | null {
	if (typeof input === 'string') {
		return parseTopicPostReference(input);
	}

	if (input && typeof input === 'object' && !Array.isArray(input)) {
		const value = String((input as IDataObject).value ?? '');
		return parseTopicPostReference(value);
	}

	return null;
}

export function getPostListFromResponse(response: unknown): IDataObject[] {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return [];
	}

	const data = response as IDataObject;
	if (Array.isArray(data.latest_posts)) {
		return data.latest_posts.filter((item): item is IDataObject => !!item && typeof item === 'object');
	}

	if (Array.isArray(data.posts)) {
		return data.posts.filter((item): item is IDataObject => !!item && typeof item === 'object');
	}

	const postStream =
		data.post_stream && typeof data.post_stream === 'object' && !Array.isArray(data.post_stream)
			? (data.post_stream as IDataObject)
			: undefined;
	if (!postStream) {
		return [];
	}

	if (!Array.isArray(postStream.posts)) {
		return [];
	}

	return postStream.posts.filter((item): item is IDataObject => !!item && typeof item === 'object');
}

export function getPostStreamIds(response: unknown): number[] {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return [];
	}

	const data = response as IDataObject;
	const postStream =
		data.post_stream && typeof data.post_stream === 'object' && !Array.isArray(data.post_stream)
			? (data.post_stream as IDataObject)
			: undefined;
	if (!postStream || !Array.isArray(postStream.stream)) {
		return [];
	}

	return postStream.stream
		.map((id) => Number(id))
		.filter((id) => Number.isInteger(id) && id > 0);
}

export function simplifyPostRevision(revision: IDataObject): IDataObject {
	return {
		post_id: revision.post_id,
		number: revision.number,
		created_at: revision.created_at,
		username: revision.username,
		title: revision.title,
		wiki: revision.wiki,
		current: revision.current,
		edit_reason: revision.edit_reason,
	};
}

function extractPostIdByPostNumber(response: unknown, postNumber: number): number | null {
	const posts = getPostListFromResponse(response);
	for (const post of posts) {
		const responsePostNumber = Number(post.post_number ?? 0);
		const responsePostId = Number(post.id ?? 0);
		if (responsePostNumber === postNumber && responsePostId > 0) {
			return responsePostId;
		}
	}

	if (posts.length === 1) {
		const singlePostId = Number(posts[0].id ?? 0);
		if (singlePostId > 0) {
			return singlePostId;
		}
	}

	return null;
}

export async function resolvePostId(this: IExecuteFunctions, itemIndex: number, input: unknown): Promise<number> {
	try {
		return getPostId(input);
	} catch {
		// Continue with topic URL resolution path.
	}

	const topicPostReference = getTopicPostReferenceFromLocator(input);
	if (!topicPostReference) {
		throw new Error('Invalid Post ID or URL');
	}

	const response = await discourseApiRequest.call(
		this,
		itemIndex,
		'GET',
		`/t/${topicPostReference.topicId}/${topicPostReference.postNumber}.json`,
	);

	const postId = extractPostIdByPostNumber(response, topicPostReference.postNumber);
	if (!postId) {
		throw new Error('Could not resolve Post ID from URL');
	}

	return postId;
}

export async function discourseApiRequestWithPathFallback(
	this: IExecuteFunctions,
	itemIndex: number,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
	paths: string[],
	qs: IDataObject = {},
	body?: IDataObject,
): Promise<unknown> {
	let lastError: unknown;

	for (const path of paths) {
		try {
			return await discourseApiRequest.call(this, itemIndex, method, path, qs, body);
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError;
}

export function mapUserActionToPost(userAction: IDataObject): IDataObject {
	return {
		id: userAction.post_id ?? userAction.id,
		topic_id: userAction.topic_id,
		topic_slug: userAction.slug,
		post_number: userAction.post_number,
		created_at: userAction.created_at,
		username: userAction.acting_username ?? userAction.username,
		name: userAction.name,
		cooked: userAction.excerpt ?? userAction.description,
		score: userAction.score,
	};
}

export function getUserPostsFromResponse(response: unknown): IDataObject[] {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return [];
	}

	const data = response as IDataObject;

	if (Array.isArray(data.posts)) {
		return data.posts.filter((item): item is IDataObject => !!item && typeof item === 'object');
	}

	if (Array.isArray(data.latest_posts)) {
		return data.latest_posts.filter((item): item is IDataObject => !!item && typeof item === 'object');
	}

	if (Array.isArray(data.user_actions)) {
		return data.user_actions
			.filter((item): item is IDataObject => !!item && typeof item === 'object')
			.map((item) => mapUserActionToPost(item));
	}

	return [];
}

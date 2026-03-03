import type { IDataObject, INodeExecutionData } from 'n8n-workflow';

function toDataObject(value: unknown): IDataObject {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return value as IDataObject;
	}

	return { value } as IDataObject;
}

export function toExecutionData(itemIndex: number, payload: unknown): INodeExecutionData[] {
	if (Array.isArray(payload)) {
		return payload.map((item) => ({
			json: toDataObject(item),
			pairedItem: { item: itemIndex },
		}));
	}

	return [
		{
			json: toDataObject(payload),
			pairedItem: { item: itemIndex },
		},
	];
}

function tryParseTopicId(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	if (/^\d+$/.test(trimmed)) {
		return Number(trimmed);
	}

	const urlMatch = trimmed.match(/\/t\/(?:[^/]+\/)?(\d+)(?:[/?#]|$)/i);
	if (urlMatch?.[1]) {
		return Number(urlMatch[1]);
	}

	return null;
}

function tryParsePostId(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	if (/^\d+$/.test(trimmed)) {
		return Number(trimmed);
	}

	const postUrlMatch = trimmed.match(/\/p\/(\d+)(?:[/?#]|$)/i);
	if (postUrlMatch?.[1]) {
		return Number(postUrlMatch[1]);
	}

	return null;
}

function tryParseCategoryId(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	if (/^\d+$/.test(trimmed)) {
		return Number(trimmed);
	}

	const urlMatch = trimmed.match(/\/c\/(?:[^/]+\/)*(\d+)(?:[/?#]|$)/i);
	if (urlMatch?.[1]) {
		return Number(urlMatch[1]);
	}

	return null;
}

function tryParseQueryId(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	if (/^\d+$/.test(trimmed)) {
		return Number(trimmed);
	}

	const queryPathMatch = trimmed.match(/\/queries\/(\d+)(?:[/?#]|$)/i);
	if (queryPathMatch?.[1]) {
		return Number(queryPathMatch[1]);
	}

	const queryParamMatch = trimmed.match(/[?&]id=(\d+)(?:[&#]|$)/i);
	if (queryParamMatch?.[1]) {
		return Number(queryParamMatch[1]);
	}

	const apiPathMatch = trimmed.match(/\/api\/query\/(\d+)(?:[/?#]|$)/i);
	if (apiPathMatch?.[1]) {
		return Number(apiPathMatch[1]);
	}

	return null;
}

function tryParseArtifactId(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	if (/^\d+$/.test(trimmed)) {
		return Number(trimmed);
	}

	const adminPathMatch = trimmed.match(/\/ai-artifacts\/(\d+)(?:\.json)?(?:[/?#]|$)/i);
	if (adminPathMatch?.[1]) {
		return Number(adminPathMatch[1]);
	}

	const viewerPathMatch = trimmed.match(/\/ai-bot\/artifacts\/(\d+)(?:\/\d+)?(?:[/?#]|$)/i);
	if (viewerPathMatch?.[1]) {
		return Number(viewerPathMatch[1]);
	}

	return null;
}

export function getTopicId(
	topicInput: unknown,
): number {
	if (typeof topicInput === 'number' && Number.isFinite(topicInput) && topicInput > 0) {
		return Math.trunc(topicInput);
	}

	if (typeof topicInput === 'string') {
		const parsedId = tryParseTopicId(topicInput);
		if (parsedId && parsedId > 0) {
			return parsedId;
		}
	}

	if (topicInput && typeof topicInput === 'object' && !Array.isArray(topicInput)) {
		const input = topicInput as IDataObject;
		const value = String(input.value ?? '');
		const parsedId = tryParseTopicId(value);
		if (parsedId && parsedId > 0) {
			return parsedId;
		}
	}

	throw new Error('Invalid Topic ID or URL');
}

export function getPostId(postInput: unknown): number {
	if (typeof postInput === 'number' && Number.isFinite(postInput) && postInput > 0) {
		return Math.trunc(postInput);
	}

	if (typeof postInput === 'string') {
		const parsedId = tryParsePostId(postInput);
		if (parsedId && parsedId > 0) {
			return parsedId;
		}
	}

	if (postInput && typeof postInput === 'object' && !Array.isArray(postInput)) {
		const input = postInput as IDataObject;
		const value = String(input.value ?? '');
		const parsedId = tryParsePostId(value);
		if (parsedId && parsedId > 0) {
			return parsedId;
		}
	}

	throw new Error('Invalid Post ID or URL');
}

export function getCategoryId(categoryInput: unknown): number {
	if (typeof categoryInput === 'number' && Number.isFinite(categoryInput) && categoryInput > 0) {
		return Math.trunc(categoryInput);
	}

	if (typeof categoryInput === 'string') {
		const parsedId = tryParseCategoryId(categoryInput);
		if (parsedId && parsedId > 0) {
			return parsedId;
		}
	}

	if (categoryInput && typeof categoryInput === 'object' && !Array.isArray(categoryInput)) {
		const input = categoryInput as IDataObject;
		const value = String(input.value ?? '');
		const parsedId = tryParseCategoryId(value);
		if (parsedId && parsedId > 0) {
			return parsedId;
		}
	}

	throw new Error('Invalid Category ID or URL');
}

export function getQueryId(queryInput: unknown): number {
	if (typeof queryInput === 'number' && Number.isFinite(queryInput) && queryInput > 0) {
		return Math.trunc(queryInput);
	}

	if (typeof queryInput === 'string') {
		const parsedId = tryParseQueryId(queryInput);
		if (parsedId && parsedId > 0) {
			return parsedId;
		}
	}

	if (queryInput && typeof queryInput === 'object' && !Array.isArray(queryInput)) {
		const input = queryInput as IDataObject;
		const value = String(input.value ?? '');
		const parsedId = tryParseQueryId(value);
		if (parsedId && parsedId > 0) {
			return parsedId;
		}
	}

	throw new Error('Invalid Query ID or URL');
}

export function getArtifactId(artifactInput: unknown): number {
	if (typeof artifactInput === 'number' && Number.isFinite(artifactInput) && artifactInput > 0) {
		return Math.trunc(artifactInput);
	}

	if (typeof artifactInput === 'string') {
		const parsedId = tryParseArtifactId(artifactInput);
		if (parsedId && parsedId > 0) {
			return parsedId;
		}
	}

	if (artifactInput && typeof artifactInput === 'object' && !Array.isArray(artifactInput)) {
		const input = artifactInput as IDataObject;
		const value = String(input.value ?? '');
		const parsedId = tryParseArtifactId(value);
		if (parsedId && parsedId > 0) {
			return parsedId;
		}
	}

	throw new Error('Invalid Artifact ID or URL');
}

function isDataObject(value: unknown): value is IDataObject {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parseJsonObjectInput(value: unknown, fieldName: string): IDataObject | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	if (isDataObject(value)) {
		return value;
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return undefined;
		}

		const parsed = JSON.parse(trimmed);
		if (!isDataObject(parsed)) {
			throw new Error(`${fieldName} must be a JSON object.`);
		}

		return parsed;
	}

	throw new Error(`${fieldName} must be a JSON object.`);
}

export function simplifyTopic(topic: IDataObject): IDataObject {
	return {
		id: topic.id,
		title: topic.title,
		slug: topic.slug,
		created_at: topic.created_at,
		last_posted_at: topic.last_posted_at,
		posts_count: topic.posts_count,
		views: topic.views,
		like_count: topic.like_count,
		category_id: topic.category_id,
		closed: topic.closed,
		pinned: topic.pinned,
	};
}

export function simplifyPrivateMessageTopic(topic: IDataObject): IDataObject {
	return {
		id: topic.id,
		title: topic.title,
		slug: topic.slug,
		created_at: topic.created_at,
		last_posted_at: topic.last_posted_at,
		posts_count: topic.posts_count,
		views: topic.views,
		like_count: topic.like_count,
		archived: topic.archived,
		closed: topic.closed,
	};
}

export function simplifyCategory(category: IDataObject): IDataObject {
	return {
		id: category.id,
		name: category.name,
		slug: category.slug,
		color: category.color,
		text_color: category.text_color,
		position: category.position,
		topic_count: category.topic_count,
		post_count: category.post_count,
		read_restricted: category.read_restricted,
		parent_category_id: category.parent_category_id,
	};
}

export function simplifyPost(post: IDataObject): IDataObject {
	return {
		id: post.id,
		topic_id: post.topic_id,
		topic_slug: post.topic_slug,
		post_number: post.post_number,
		created_at: post.created_at,
		username: post.username,
		name: post.name,
		cooked: post.cooked,
		reply_count: post.reply_count,
		reads: post.reads,
		score: post.score,
	};
}

export function simplifyUpload(upload: IDataObject): IDataObject {
	return {
		id: upload.id,
		url: upload.url,
		short_url: upload.short_url,
		short_path: upload.short_path,
		original_filename: upload.original_filename,
		filesize: upload.filesize,
		width: upload.width,
		height: upload.height,
		extension: upload.extension,
	};
}

export function simplifyDataExplorerQuery(query: IDataObject): IDataObject {
	return {
		id: query.id,
		name: query.name,
		description: query.description,
		created_at: query.created_at,
		updated_at: query.updated_at,
		username: query.username,
		last_run_at: query.last_run_at,
		run_count: query.run_count,
		hidden: query.hidden,
		group_ids: query.group_ids,
	};
}

export function simplifyAiArtifact(artifact: IDataObject): IDataObject {
	return {
		id: artifact.id,
		name: artifact.name,
		user_id: artifact.user_id,
		post_id: artifact.post_id,
		public: !!(artifact.metadata && isDataObject(artifact.metadata) && artifact.metadata.public),
		created_at: artifact.created_at,
		updated_at: artifact.updated_at,
	};
}

export function getTopicsFromResponse(response: unknown): IDataObject[] {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return [];
	}

	const data = response as IDataObject;

	if (Array.isArray(data.topics)) {
		return data.topics.filter((item): item is IDataObject => !!item && typeof item === 'object');
	}

	const topicList = data.topic_list as IDataObject | undefined;
	if (!topicList || typeof topicList !== 'object') {
		return [];
	}

	const topics = topicList.topics;
	if (!Array.isArray(topics)) {
		return [];
	}

	return topics.filter((item): item is IDataObject => !!item && typeof item === 'object');
}

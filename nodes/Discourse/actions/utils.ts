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

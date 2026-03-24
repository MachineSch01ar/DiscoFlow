#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const ACTIONS_ROOT = path.join(PACKAGE_ROOT, 'nodes', 'Discourse', 'actions');
const CSV_PATH = path.join(REPO_ROOT, 'discourse-extended-skills.csv');

const CSV_HEADER = [
	'skill_key',
	'enabled',
	'scope',
	'name',
	'description_short',
	'catalog_line',
	'tags_json',
	'instructions_md',
	'resources_json',
	'version',
	'source_sha',
	'updated_at',
];

const REQUIRED_SECTIONS = [
	'## What This Tool Does',
	'## Parameters',
	'## How To Think About This Tool',
	'## Examples',
	'## Output, Failure Modes, And Guardrails',
];

const EXTRA_CREDENTIALS = {
	'post.generateTtsAudio': ['ElevenLabs API'],
	'post.generateTtsAudioWithSpacesUpload': ['ElevenLabs API', 'DigitalOcean Spaces API'],
};

const RESOURCE_NOTES = {
	aiArtifact: {
		prerequisites: [
			'Requires Discourse AI artifact endpoints to be enabled and accessible to the credentialed user.',
		],
	},
	aiArtifactStorage: {
		prerequisites: [
			'Requires a real AI artifact target plus access to the artifact key/value endpoints exposed by the Discourse AI plugin.',
		],
	},
	dataExplorer: {
		prerequisites: [
			'Requires the Data Explorer plugin plus credentials with permission to read or run the selected query.',
		],
	},
	personalMessage: {
		prerequisites: [
			'Requires permission to view or modify the personal message topic and to message the selected users or groups.',
		],
	},
	upload: {
		prerequisites: [
			'Choose the upload action based on where the file currently lives: in n8n binary data, at a source URL, or behind a presigned object-storage URL.',
		],
	},
};

const ACTION_OVERRIDES = {
	'aiArtifactStorage.create': {
		decision:
			'Use this only when the key must be new. If the key might already exist, prefer `aiArtifactStorage.set`. If the key definitely exists and you only want to change it, prefer `aiArtifactStorage.update`.',
	},
	'aiArtifactStorage.set': {
		decision:
			'Use this when idempotent write behavior is acceptable and you do not want to branch on create-vs-update yourself.',
	},
	'aiArtifactStorage.update': {
		decision:
			'Use this only when the key is expected to exist already and a missing key should be treated as an error rather than an implicit create.',
	},
	'dataExplorer.run': {
		decision:
			'Use this to execute an existing saved query. Do not use it to create or edit the query definition.',
	},
	'post.generateTtsAudio': {
		decision:
			'Use this when you need generated audio back inside n8n. If you only need cleaned or chunked text, use `post.prepareForTts`. If you also need the result uploaded to Spaces, use `post.generateTtsAudioWithSpacesUpload`.',
	},
	'post.generateTtsAudioWithSpacesUpload': {
		decision:
			'Use this when you need generated audio plus a DigitalOcean Spaces upload in the same action. If local binary output is enough, use `post.generateTtsAudio`.',
	},
	'post.prepareForTts': {
		decision:
			'Use this as a preprocessing step when you need clean text or chunk diagnostics before calling a TTS model. It does not synthesize audio by itself.',
	},
	'topic.search': {
		decision:
			'Use this when the topic identifier is unknown and you need to discover candidates from text. If you already know the topic ID or URL, use `topic.get` instead.',
	},
	'upload.create': {
		decision:
			'Use this when the file already exists in n8n binary data and Discourse should create the upload record for you. If the file lives at a remote URL, use `upload.createFromSourceUrl`. If you only need a raw PUT to object storage, use `upload.uploadToObjectStorage`.',
	},
	'upload.createFromSourceUrl': {
		decision:
			'Use this when Discourse should fetch the file from a remote URL itself. If the bytes are already inside n8n, use `upload.create`.',
	},
	'upload.uploadToObjectStorage': {
		decision:
			'Use this only for a presigned PUT upload workflow. It does not create a Discourse upload record by itself.',
	},
};

function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = '';
	let inQuotes = false;

	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		const next = text[index + 1];

		if (inQuotes) {
			if (char === '"' && next === '"') {
				field += '"';
				index++;
				continue;
			}
			if (char === '"') {
				inQuotes = false;
				continue;
			}
			field += char;
			continue;
		}

		if (char === '"') {
			inQuotes = true;
			continue;
		}
		if (char === ',') {
			row.push(field);
			field = '';
			continue;
		}
		if (char === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			continue;
		}
		if (char === '\r') {
			continue;
		}
		field += char;
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

function serializeCsv(rows) {
	return `${rows
		.map((row) =>
			row
				.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
				.join(','),
		)
		.join('\n')}\n`;
}

function readSourceFile(filePath) {
	return ts.createSourceFile(
		filePath,
		fs.readFileSync(filePath, 'utf8'),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
}

function getPropertyName(property) {
	if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)) {
		return property.name.text;
	}

	return null;
}

function buildConstMap(sourceFile) {
	const constMap = new Map();

	const visit = (node) => {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			constMap.set(node.name.text, node.initializer);
		}
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return constMap;
}

function evaluateNode(node, constMap, stack = new Set()) {
	if (!node) return undefined;

	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	if (ts.isNumericLiteral(node)) {
		return Number(node.text);
	}
	if (node.kind === ts.SyntaxKind.TrueKeyword) {
		return true;
	}
	if (node.kind === ts.SyntaxKind.FalseKeyword) {
		return false;
	}
	if (node.kind === ts.SyntaxKind.NullKeyword) {
		return null;
	}
	if (ts.isIdentifier(node)) {
		if (node.text === 'undefined') {
			return undefined;
		}
		if (stack.has(node.text)) {
			return undefined;
		}
		const initializer = constMap.get(node.text);
		if (!initializer) {
			return undefined;
		}
		stack.add(node.text);
		const value = evaluateNode(initializer, constMap, stack);
		stack.delete(node.text);
		return value;
	}
	if (ts.isArrayLiteralExpression(node)) {
		return node.elements.map((element) => evaluateNode(element, constMap, stack));
	}
	if (ts.isObjectLiteralExpression(node)) {
		const result = {};
		for (const property of node.properties) {
			if (ts.isPropertyAssignment(property)) {
				const name = getPropertyName(property);
				if (!name) continue;
				result[name] = evaluateNode(property.initializer, constMap, stack);
				continue;
			}
			if (ts.isShorthandPropertyAssignment(property)) {
				const name = property.name.text;
				result[name] = evaluateNode(property.name, constMap, stack);
				continue;
			}
			if (ts.isSpreadAssignment(property)) {
				const value = evaluateNode(property.expression, constMap, stack);
				if (value && typeof value === 'object' && !Array.isArray(value)) {
					Object.assign(result, value);
				}
			}
		}
		return result;
	}
	if (ts.isPrefixUnaryExpression(node)) {
		const operand = evaluateNode(node.operand, constMap, stack);
		if (typeof operand !== 'number') {
			return undefined;
		}
		if (node.operator === ts.SyntaxKind.MinusToken) return -operand;
		if (node.operator === ts.SyntaxKind.PlusToken) return operand;
		return undefined;
	}

	return undefined;
}

function getOperationChoices(indexPath) {
	const sourceFile = readSourceFile(indexPath);
	const constMap = buildConstMap(sourceFile);
	let operationField;

	const visit = (node) => {
		if (operationField) return;
		if (
			ts.isObjectLiteralExpression(node) &&
			node.properties.some(
				(property) =>
					ts.isPropertyAssignment(property) &&
					getPropertyName(property) === 'name' &&
					evaluateNode(property.initializer, constMap) === 'operation',
			)
		) {
			operationField = node;
			return;
		}
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	if (!operationField) {
		throw new Error(`Could not find operation field in ${indexPath}`);
	}

	const operationFieldValue = evaluateNode(operationField, constMap);
	return Array.isArray(operationFieldValue?.options) ? operationFieldValue.options : [];
}

function parseFieldMeta(fieldValue, parentField = null) {
	if (!fieldValue || typeof fieldValue !== 'object' || Array.isArray(fieldValue)) {
		return null;
	}

	const displayName = String(fieldValue.displayName ?? '').trim();
	const name = String(fieldValue.name ?? '').trim();
	const type = String(fieldValue.type ?? '').trim();
	if (!displayName || !name || !type) {
		return null;
	}

	const displayOptions = fieldValue.displayOptions ?? {};
	const showOptions = displayOptions.show ?? {};
	const operations = normalizeArray(showOptions.operation).map(String).filter(Boolean);
	const conditions = Object.fromEntries(
		Object.entries(showOptions).filter(([key]) => key !== 'resource' && key !== 'operation'),
	);

	const field = {
		displayName,
		name,
		type,
		required: Boolean(fieldValue.required),
		description: typeof fieldValue.description === 'string' ? fieldValue.description.trim() : '',
		defaultValue: fieldValue.default,
		operations,
		conditions,
		parentField,
		options: normalizeArray(fieldValue.options)
			.map((option) => {
				if (!option || typeof option !== 'object' || Array.isArray(option)) {
					return null;
				}
				return {
					name: option.name ? String(option.name) : undefined,
					value: option.value,
					description: typeof option.description === 'string' ? option.description.trim() : '',
				};
			})
			.filter(Boolean),
		modes: normalizeArray(fieldValue.modes)
			.map((mode) => {
				if (!mode || typeof mode !== 'object' || Array.isArray(mode)) {
					return null;
				}
				return {
					displayName: mode.displayName ? String(mode.displayName) : undefined,
					name: mode.name ? String(mode.name) : undefined,
					type: mode.type ? String(mode.type) : undefined,
					placeholder: mode.placeholder ? String(mode.placeholder) : undefined,
				};
			})
			.filter(Boolean),
		nestedFields: [],
	};

	if (type === 'collection' || type === 'fixedCollection') {
		field.nestedFields = normalizeArray(fieldValue.options)
			.map((option) => parseFieldMeta(option, field))
			.filter(Boolean);
	}

	return field;
}

function normalizeArray(value) {
	return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function getFieldsFromOperationFile(filePath) {
	const sourceFile = readSourceFile(filePath);
	const constMap = buildConstMap(sourceFile);
	let descriptionArray;

	const visit = (node) => {
		if (descriptionArray) return;
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.name.text === 'description' &&
			node.initializer &&
			ts.isArrayLiteralExpression(node.initializer)
		) {
			descriptionArray = node.initializer;
			return;
		}
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	if (!descriptionArray) {
		return [];
	}

	const fields = [];
	for (const element of descriptionArray.elements) {
		if (!ts.isObjectLiteralExpression(element)) {
			continue;
		}
		const fieldValue = evaluateNode(element, constMap);
		const field = parseFieldMeta(fieldValue);
		if (field) {
			fields.push(field);
		}
	}

	return fields;
}

function loadActionCatalog() {
	const actions = [];
	const resources = fs.readdirSync(ACTIONS_ROOT).sort();

	for (const resource of resources) {
		const resourceDir = path.join(ACTIONS_ROOT, resource);
		const indexPath = path.join(resourceDir, 'index.ts');
		if (!fs.existsSync(indexPath)) continue;

		const operationChoices = getOperationChoices(indexPath);
		const operationFiles = fs
			.readdirSync(path.join(resourceDir, 'operations'))
			.filter((entry) => entry.endsWith('.operation.ts'))
			.sort();
		const fieldsByOperation = new Map();

		for (const operationFile of operationFiles) {
			const filePath = path.join(resourceDir, 'operations', operationFile);
			for (const field of getFieldsFromOperationFile(filePath)) {
				const targetOperations = field.operations.length > 0 ? field.operations : [operationFile.replace(/\.operation\.ts$/, '')];
				for (const operation of targetOperations) {
					const currentFields = fieldsByOperation.get(operation) ?? [];
					currentFields.push(field);
					fieldsByOperation.set(operation, currentFields);
				}
			}
		}

		for (const option of operationChoices) {
			const key = `${resource}.${option.value}`;
			actions.push({
				skillKey: key,
				resource,
				operation: String(option.value),
				operationName: String(option.name),
				actionLabel: String(option.action),
				fields: fieldsByOperation.get(String(option.value)) ?? [],
			});
		}
	}

	return actions.sort((left, right) => left.skillKey.localeCompare(right.skillKey));
}

function toTitleCase(value) {
	return value
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function describeResource(resource) {
	switch (resource) {
		case 'aiArtifact':
			return 'an AI artifact attached to a Discourse post';
		case 'aiArtifactStorage':
			return 'a key/value entry scoped to an AI artifact';
		case 'category':
			return 'a Discourse category';
		case 'dataExplorer':
			return 'a Discourse Data Explorer query';
		case 'personalMessage':
			return 'a Discourse personal message topic';
		case 'post':
			return 'a Discourse post or post-side utility action';
		case 'topic':
			return 'a Discourse topic';
		case 'upload':
			return 'an upload or upload-adjacent workflow';
		default:
			return resource;
	}
}

function getActionMode(action) {
	const { operation } = action;
	if (operation === 'search') return 'search';
	if (operation.startsWith('getMany')) return 'list';
	if (operation.startsWith('getRevision')) return 'revision';
	if (operation === 'get') return 'get';
	if (operation === 'create' || operation === 'createFromSourceUrl') return 'create';
	if (operation === 'update' || operation === 'set' || operation === 'setStatus') return 'update';
	if (operation === 'delete') return 'delete';
	if (operation === 'run') return 'run';
	if (operation === 'prepareForTts') return 'utility';
	if (operation.startsWith('generateTtsAudio')) return 'tts';
	if (['addParticipant', 'addParticipants', 'removeParticipant', 'reply', 'inviteGroup'].includes(operation)) {
		return 'conversation';
	}
	if (['bookmark', 'unbookmark', 'like', 'unlike', 'recover'].includes(operation)) {
		return 'stateChange';
	}
	if (operation === 'uploadToObjectStorage') return 'upload';
	return 'generic';
}

function isMutatingAction(action) {
	return !['get', 'search', 'run', 'prepareForTts'].includes(action.operation) && !action.operation.startsWith('getMany') && !action.operation.startsWith('getRevision');
}

function isDestructiveAction(action) {
	return ['delete', 'removeParticipant', 'unbookmark', 'unlike'].includes(action.operation);
}

function getCredentialLine(action) {
	const credentials = ['Discourse API (Discourse Extended)'];
	for (const credential of EXTRA_CREDENTIALS[action.skillKey] ?? []) {
		credentials.push(credential);
	}

	return `Credentials: ${credentials.map((credential) => `\`${credential}\``).join(', ')}.`;
}

function getActionIntroduction(action) {
	const actionMode = getActionMode(action);
	const kind = {
		create:
			action.resource === 'upload'
				? 'This is a write action that creates a new upload-side effect.'
				: 'This is a write action that creates new Discourse state.',
		update: 'This is a write action that changes existing state and expects you to target the right record first.',
		delete: 'This is a destructive action and should only run with explicit intent plus an exact identifier.',
		get: 'This is a read action for one known object.',
		list: 'This is a read action that returns multiple records and is best when discovery or pagination matters.',
		search: 'This is a discovery action driven by a text query rather than a known identifier.',
		run: 'This is a read-style execution action that runs an existing query definition.',
		utility: 'This is a utility action that transforms content for downstream steps instead of mutating Discourse records.',
		tts: 'This is a utility action that calls external TTS services and can return binary artifacts.',
		conversation: 'This is a targeted write action against an existing personal message conversation.',
		stateChange: 'This is a targeted write action that toggles state on an existing post.',
		upload: 'This is an upload utility action and does not create a full Discourse record unless the operation explicitly says so.',
		generic: 'Use this action when the workflow needs the exact operation selected in the Discourse Extended node.',
	}[actionMode];

	return [
		`Use this skill when the workflow needs the Discourse Extended node to run \`${action.skillKey}\` (${action.actionLabel}).`,
		`Primary target: ${describeResource(action.resource)}.`,
		kind,
		getCredentialLine(action),
		...(RESOURCE_NOTES[action.resource]?.prerequisites ?? []),
	];
}

function formatValue(value) {
	if (value === undefined || value === null || value === '') return null;
	if (Array.isArray(value) || (value && typeof value === 'object')) return null;
	if (typeof value === 'string') return `\`${value}\``;
	if (typeof value === 'number' || typeof value === 'boolean') return `\`${String(value)}\``;
	try {
		return `\`${JSON.stringify(value)}\``;
	} catch {
		return `\`${String(value)}\``;
	}
}

function formatShowConditions(field) {
	const parts = Object.entries(field.conditions ?? {}).map(([key, values]) => {
		const conditionValues = normalizeArray(values)
			.map((value) => (typeof value === 'string' ? `\`${value}\`` : `\`${String(value)}\``))
			.join(' or ');
		return `${toTitleCase(key)} is ${conditionValues}`;
	});

	if (parts.length === 0) {
		return null;
	}

	return `Shown when ${parts.join(' and ')}.`;
}

function formatOptions(field) {
	if (!Array.isArray(field.options) || field.options.length === 0 || ['collection', 'fixedCollection'].includes(field.type)) {
		return null;
	}

	const formatted = field.options
		.map((option) => {
			const label = option.name ? `${option.name}` : `${option.value}`;
			const value = option.value === undefined ? null : `(\`${String(option.value)}\`)`;
			return [label, value].filter(Boolean).join(' ');
		})
		.join(', ');

	return formatted ? `Choices: ${formatted}.` : null;
}

function formatModes(field) {
	if (!Array.isArray(field.modes) || field.modes.length === 0) {
		return null;
	}

	const formatted = field.modes
		.map((mode) => {
			const details = [];
			if (mode.displayName) {
				details.push(mode.displayName);
			}
			if (mode.name) {
				details.push(`mode \`${mode.name}\``);
			}
			if (mode.placeholder) {
				details.push(`placeholder ${formatValue(mode.placeholder)}`);
			}
			return details.join(', ');
		})
		.filter(Boolean)
		.join('; ');

	return formatted ? `Accepted locator modes: ${formatted}.` : null;
}

function synthesizeFieldDescription(field) {
	switch (field.type) {
		case 'resourceLocator':
			return 'Accepts either a numeric identifier or a matching Discourse URL that resolves to the same identifier.';
		case 'json':
			return 'Provide valid JSON. Invalid JSON should be treated as a local validation failure before execution.';
		case 'collection':
		case 'fixedCollection':
			return 'Optional grouped inputs. Only include nested keys you intentionally want to send.';
		case 'options':
			return 'Choose the option that matches the target API behavior.';
		case 'boolean':
			return 'Boolean flag that changes request behavior or output shape.';
		default:
			return `Input value for ${field.displayName.toLowerCase()}.`;
	}
}

function ensureSentence(text) {
	const trimmed = String(text ?? '').trim();
	if (!trimmed) {
		return '';
	}
	return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function fieldSignature(field, internalName) {
	const tokens = [internalName ? `\`${internalName}\`` : null, field.type, field.required ? 'required' : 'optional'].filter(Boolean);
	return tokens.join(', ');
}

function formatFieldBullet(field, parentField = null) {
	const internalName = parentField ? `${parentField.name}.${field.name}` : field.name;
	const label = parentField ? `${parentField.displayName} -> ${field.displayName}` : field.displayName;
	const notes = [
		ensureSentence(field.description || synthesizeFieldDescription(field)),
		formatShowConditions(field),
		formatModes(field),
		formatOptions(field),
		formatValue(field.defaultValue) ? `Default: ${formatValue(field.defaultValue)}.` : null,
	]
		.filter(Boolean)
		.join(' ');

	return `- **${label}** (${fieldSignature(field, internalName)}): ${notes}`;
}

function buildParameterSection(action) {
	const lines = [];

	for (const field of action.fields) {
		lines.push(formatFieldBullet(field));
		if (field.nestedFields.length > 0) {
			for (const nestedField of field.nestedFields) {
				lines.push(formatFieldBullet(nestedField, field));
			}
		}
	}

	return lines;
}

function alternativeAction(action) {
	const { resource, operation } = action;

	if (operation === 'create') {
		if (resource === 'upload') return 'upload.createFromSourceUrl';
		if (resource === 'personalMessage') return 'personalMessage.reply';
		return `${resource}.update`;
	}
	if (operation === 'update') return `${resource}.create`;
	if (operation === 'get') return resource === 'topic' ? 'topic.search' : `${resource}.${getListNeighbor(resource)}`;
	if (operation.startsWith('getMany')) return `${resource}.get`;
	if (operation === 'search') return `${resource}.get`;
	if (operation === 'delete') {
		if (resource === 'post') return 'post.recover';
		return `${resource}.get`;
	}
	if (operation === 'createFromSourceUrl') return 'upload.create';
	if (operation === 'uploadToObjectStorage') return 'upload.create';
	if (operation === 'prepareForTts') return 'post.generateTtsAudio';
	if (operation === 'generateTtsAudio') return 'post.generateTtsAudioWithSpacesUpload';
	if (operation === 'generateTtsAudioWithSpacesUpload') return 'post.generateTtsAudio';
	if (operation === 'set') return 'aiArtifactStorage.update';
	if (operation === 'run') return 'dataExplorer.get';
	if (operation === 'setStatus') return 'topic.update';
	if (operation === 'reply') return 'personalMessage.create';
	if (operation === 'addParticipant') return 'personalMessage.addParticipants';
	if (operation === 'addParticipants') return 'personalMessage.addParticipant';
	if (operation === 'bookmark') return 'post.unbookmark';
	if (operation === 'like') return 'post.unlike';
	if (operation === 'getRevisionLatest') return 'post.getRevisionVersion';
	if (operation === 'getRevisionVersion') return 'post.getRevisionLatest';
	return null;
}

function getListNeighbor(resource) {
	switch (resource) {
		case 'topic':
			return 'getManyLatest';
		case 'post':
			return 'getManyTopic';
		case 'personalMessage':
			return 'getManyInbox';
		case 'dataExplorer':
		case 'category':
		case 'aiArtifact':
		case 'aiArtifactStorage':
			return 'getMany';
		default:
			return 'getMany';
	}
}

function getThinkGuidance(action) {
	const lines = [];
	const actionMode = getActionMode(action);
	const identifierFields = action.fields.filter((field) => field.type === 'resourceLocator');
	const requiredFields = action.fields.filter((field) => field.required);
	const jsonFields = action.fields.filter((field) => field.type === 'json');
	const binaryFields = action.fields.filter((field) => field.name === 'binaryPropertyName');
	const alternative = alternativeAction(action);

	if (identifierFields.length > 0) {
		lines.push(
			'Resolve the target record first. If the ID or URL is missing, ambiguous, or inferred from weak context, stop and gather that identifier before executing.',
		);
	} else if (actionMode === 'search' || actionMode === 'list') {
		lines.push(
			'This action is appropriate when discovery matters more than a single known identifier. Use it to find candidate records, then follow up with a targeted `get` or `update` action if necessary.',
		);
	}

	if (requiredFields.length > 0) {
		lines.push(
			`Treat the required inputs as the minimum contract: ${requiredFields
				.map((field) => `\`${field.name}\``)
				.join(', ')}. Do not guess missing required values unless the workflow already provides an exact source.`,
		);
	}

	if (jsonFields.length > 0) {
		lines.push(
			'Validate JSON-shaped inputs locally before execution. Malformed JSON should be treated as a user or workflow construction error, not as a retryable API error.',
		);
	}

	if (binaryFields.length > 0) {
		lines.push(
			'Confirm that the named binary field exists on the incoming item and contains the intended file. A missing or wrong binary field means the action should not run yet.',
		);
	}

	if (isDestructiveAction(action)) {
		lines.push(
			'This action changes or removes state. Prefer exact identifiers over search results, require explicit intent, and avoid running it from vague natural-language requests.',
		);
	} else if (isMutatingAction(action)) {
		lines.push(
			'Because this action mutates state or external systems, prefer deterministic inputs over inferred ones and preserve audit-friendly context about what changed and why.',
		);
	} else {
		lines.push(
			'Because this is a read or utility action, it is safe for discovery, validation, and branching. Use it before a write action when you need to confirm state.',
		);
	}

	if (alternative) {
		lines.push(`If the real intent is closer to \`${alternative}\`, switch to that action instead of forcing this one to fit.`);
	}

	if (ACTION_OVERRIDES[action.skillKey]?.decision) {
		lines.push(ACTION_OVERRIDES[action.skillKey].decision);
	}

	return lines;
}

function getPrimaryExampleValue(field) {
	const lowerName = field.name.toLowerCase();
	const lowerLabel = field.displayName.toLowerCase();

	if (lowerName.includes('binarypropertyname')) {
		return 'data';
	}
	if (lowerName.includes('audiobinaryfieldname')) {
		return 'audio';
	}
	if (lowerName.includes('transcriptbinaryfieldname')) {
		return 'transcript';
	}
	if (lowerName.includes('cleanedtext')) {
		return 'Welcome to the weekly community update.';
	}
	if (field.type === 'resourceLocator') {
		return '123';
	}
	if (lowerName === 'query') {
		return 'billing outage';
	}
	if (lowerName.includes('query') && lowerName.includes('json')) {
		return '{"min_posts":10}';
	}
	if (lowerName.includes('permissionsjson')) {
		return '{"staff":1,"everyone":1}';
	}
	if (lowerName.includes('metadatajson')) {
		return '{"public":false,"source":"n8n"}';
	}
	if (lowerName.includes('sql')) {
		return 'SELECT id, name FROM users LIMIT 10';
	}
	if (lowerName.includes('title')) {
		return 'Quarterly roadmap discussion';
	}
	if (lowerName === 'description') {
		return 'Internal updates and release notes';
	}
	if (lowerName.includes('rawtextoverride')) {
		return 'This is already cleaned text for narration.';
	}
	if (lowerName === 'raw') {
		return 'Initial post body for the workflow.';
	}
	if (lowerName.includes('name')) {
		if (lowerLabel.includes('query')) return 'Posts by staff';
		if (lowerLabel.includes('group')) return 'staff';
		if (lowerLabel.includes('file')) return 'episode-12-audio';
		if (lowerLabel.includes('bucket')) return 'community-assets';
		return 'release-plan';
	}
	if (lowerName.includes('html')) {
		return '<div>Artifact preview</div>';
	}
	if (lowerName === 'css') {
		return '.artifact { color: #222; }';
	}
	if (lowerName === 'js') {
		return 'console.log("artifact loaded");';
	}
	if (lowerName.includes('username')) {
		return 'alice';
	}
	if (lowerName.includes('group')) {
		return 'staff';
	}
	if (lowerName.includes('sourceurl')) {
		return 'https://example.com/report.pdf';
	}
	if (lowerName.includes('presignedurl')) {
		return 'https://example-space.nyc3.digitaloceanspaces.com/object?X-Amz-Signature=...';
	}
	if (lowerName.includes('voiceid')) {
		return 'EXAVITQu4vr4xnSDxMaL';
	}
	if (lowerName.includes('modelid')) {
		return 'eleven_multilingual_v2';
	}
	if (lowerName.includes('key')) {
		return 'summary_markdown';
	}
	if (lowerName.includes('slug')) {
		return 'product-updates';
	}
	if (lowerName.includes('value')) {
		return 'Generated summary text';
	}
	if (field.type === 'boolean') {
		return field.defaultValue === true ? 'true' : 'false';
	}
	if (field.type === 'number') {
		return '1';
	}
	if (field.type === 'options' && field.options.length > 0) {
		return String(field.options[0].value);
	}
	if (field.type === 'json') {
		return '{"example":true}';
	}

	return 'example-value';
}

function buildMinimalExample(action) {
	const exampleFields = [];
	for (const field of action.fields) {
		if (field.required || field.name === 'simplify' || field.name === 'resultOnly') {
			exampleFields.push(field);
		}
		if (exampleFields.length >= 5) break;
	}

	const assignments = exampleFields
		.map((field) => `\`${field.name}\`=${getPrimaryExampleValue(field)}`)
		.join(', ');

	return `Minimal: Configure Discourse Extended with Resource \`${action.resource}\` and Operation \`${action.operation}\`, then set ${assignments}.`;
}

function buildDecisionExample(action) {
	const alternative = alternativeAction(action);
	if (!alternative) {
		return `Decision: Choose \`${action.skillKey}\` only when the workflow explicitly needs ${action.actionLabel.toLowerCase()}. Otherwise prefer the narrower read action that confirms state first.`;
	}

	return `Decision: If the real need is closer to \`${alternative}\`, do not force \`${action.skillKey}\` to handle it. Switch tools instead so the workflow stays predictable.`;
}

function buildOutputGuidance(action) {
	const lines = [];
	const simplifyField = action.fields.find((field) => field.name === 'simplify');
	const outputModeField = action.fields.find((field) => field.name === 'outputMode');
	const resultOnlyField = action.fields.find((field) => field.name === 'resultOnly');
	const returnMetadataField = action.fields.find((field) => field.name === 'returnMetadata');
	const binaryField = action.fields.find((field) => field.name === 'includeBinaryData');

	if (simplifyField) {
		lines.push(
			'Output shape can change based on `simplify`. When `true`, expect a narrower, workflow-friendly payload; when `false`, expect the fuller raw API response.',
		);
	}
	if (outputModeField) {
		lines.push(
			`Output shape can change based on \`outputMode\`. Valid modes: ${outputModeField.options
				.map((option) => `\`${String(option.value)}\``)
				.join(', ')}.`,
		);
	}
	if (resultOnlyField) {
		lines.push(
			'When `resultOnly` is enabled, expect just the result rows/columns payload instead of the full Data Explorer response envelope.',
		);
	}
	if (returnMetadataField) {
		lines.push(
			'When `returnMetadata` is disabled, the action intentionally returns only a simple uploaded confirmation instead of transport metadata.',
		);
	}
	if (binaryField) {
		lines.push(
			'When binary output is enabled, downstream nodes must expect binary fields in addition to JSON. If binary output is disabled, do not assume audio files are attached.',
		);
	}

	lines.push(
		'Common failure modes: authentication problems, malformed locators or JSON, missing dependent fields for conditional inputs, and permission errors from the underlying Discourse endpoint.',
	);

	if (isDestructiveAction(action)) {
		lines.push(
			'Guardrail: require exact target confirmation before execution and do not substitute search results or fuzzy matches into this action automatically.',
		);
	} else if (isMutatingAction(action)) {
		lines.push(
			'Guardrail: only send fields the workflow truly intends to change. Optional fields should stay unset unless the caller has a concrete reason to include them.',
		);
	} else {
		lines.push(
			'Guardrail: if this action is being used to prepare for a later write, preserve the identifiers and output mode needed by the downstream step instead of over-simplifying too early.',
		);
	}

	return lines;
}

function buildInstructions(action) {
	return [
		REQUIRED_SECTIONS[0],
		...getActionIntroduction(action).map((line) => `- ${line}`),
		'',
		REQUIRED_SECTIONS[1],
		...buildParameterSection(action),
		'',
		REQUIRED_SECTIONS[2],
		...getThinkGuidance(action).map((line) => `- ${line}`),
		'',
		REQUIRED_SECTIONS[3],
		`- ${buildMinimalExample(action)}`,
		`- ${buildDecisionExample(action)}`,
		'',
		REQUIRED_SECTIONS[4],
		...buildOutputGuidance(action).map((line) => `- ${line}`),
	].join('\n');
}

function readCatalogRows() {
	const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
	const header = rows[0] ?? [];
	const indexByHeader = Object.fromEntries(header.map((column, index) => [column, index]));

	return rows.slice(1).map((row) => ({
		header,
		get(column) {
			const index = indexByHeader[column];
			return index === undefined ? '' : row[index] ?? '';
		},
	}));
}

function buildRefreshedCsv(actionCatalog) {
	const existingRows = new Map(
		readCatalogRows().map((row) => [row.get('skill_key'), row]),
	);
	const gitSha = safeExec('git rev-parse HEAD', REPO_ROOT)?.trim() ?? 'unknown';
	const shortSha = safeExec('git rev-parse --short HEAD', REPO_ROOT)?.trim() ?? 'unknown';
	const updatedAt = new Date().toISOString();

	const rows = [CSV_HEADER];
	for (const action of actionCatalog) {
		const current = existingRows.get(action.skillKey);
		rows.push([
			action.skillKey,
			current?.get('enabled') || 'true',
			current?.get('scope') || 'discourse-extended',
			current?.get('name') || `${toTitleCase(action.resource)} - ${action.operationName}`,
			current?.get('description_short') ||
				`Use this skill when you need to ${action.actionLabel.toLowerCase()} via Discourse Extended.`,
			current?.get('catalog_line') ||
				`${action.skillKey}: Use this skill when you need to ${action.actionLabel.toLowerCase()} via Discourse Extended.`,
			current?.get('tags_json') || JSON.stringify(['discourse-extended', action.resource, action.operation]),
			buildInstructions(action),
			current?.get('resources_json') || '[]',
			`git-${shortSha}`,
			gitSha,
			updatedAt,
		]);
	}

	return serializeCsv(rows);
}

function safeExec(command, cwd) {
	try {
		return execSync(command, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
	} catch {
		return null;
	}
}

function validateCatalog(actionCatalog) {
	const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
	const header = rows[0] ?? [];
	const errors = [];

	if (header.join(',') !== CSV_HEADER.join(',')) {
		errors.push(`CSV header mismatch. Expected: ${CSV_HEADER.join(', ')}`);
	}

	const indexByHeader = Object.fromEntries(header.map((column, index) => [column, index]));
	const skillKeyIndex = indexByHeader.skill_key;
	const instructionsIndex = indexByHeader.instructions_md;
	if (skillKeyIndex === undefined) {
		errors.push('CSV missing `skill_key` column.');
	}
	if (instructionsIndex === undefined) {
		errors.push('CSV missing `instructions_md` column.');
	}

	const actionKeys = actionCatalog.map((action) => action.skillKey);
	const csvKeys = rows.slice(1).map((row) => row[skillKeyIndex] ?? '').filter(Boolean);
	const actionSet = new Set(actionKeys);
	const csvSet = new Set(csvKeys);

	for (const actionKey of actionKeys) {
		if (!csvSet.has(actionKey)) {
			errors.push(`Missing CSV row for action key: ${actionKey}`);
		}
	}
	for (const csvKey of csvKeys) {
		if (!actionSet.has(csvKey)) {
			errors.push(`Extra CSV row not present in action surface: ${csvKey}`);
		}
	}

	const duplicates = csvKeys.filter((key, index) => csvKeys.indexOf(key) !== index);
	for (const duplicate of new Set(duplicates)) {
		errors.push(`Duplicate CSV row for action key: ${duplicate}`);
	}

	for (const row of rows.slice(1)) {
		const skillKey = row[skillKeyIndex] ?? '';
		const instructions = row[instructionsIndex] ?? '';
		if (!instructions.trim().startsWith('## ')) {
			errors.push(`${skillKey}: instructions_md must start with an H2 heading.`);
		}
		if (/^#\s/m.test(instructions)) {
			errors.push(`${skillKey}: instructions_md must not contain H1 headings.`);
		}
		for (const section of REQUIRED_SECTIONS) {
			if (!instructions.includes(section)) {
				errors.push(`${skillKey}: instructions_md missing required section ${section}.`);
			}
		}

		const action = actionCatalog.find((candidate) => candidate.skillKey === skillKey);
		if (!action) continue;

		for (const field of action.fields) {
			validateFieldCoverage(skillKey, instructions, field, errors);
			for (const nestedField of field.nestedFields) {
				validateFieldCoverage(skillKey, instructions, nestedField, errors, field);
			}
		}
	}

	return errors;
}

function validateFieldCoverage(skillKey, instructions, field, errors, parentField = null) {
	const displayLabel = parentField ? `${parentField.displayName} -> ${field.displayName}` : field.displayName;
	const internalName = parentField ? `${parentField.name}.${field.name}` : field.name;

	if (!instructions.includes(`**${displayLabel}**`)) {
		errors.push(`${skillKey}: instructions_md missing parameter label for ${displayLabel}.`);
	}
	if (!instructions.includes(`\`${internalName}\``)) {
		errors.push(`${skillKey}: instructions_md missing internal parameter name \`${internalName}\`.`);
	}
}

function runCheck() {
	const actionCatalog = loadActionCatalog();
	const errors = validateCatalog(actionCatalog);
	if (errors.length > 0) {
		for (const error of errors) {
			console.error(error);
		}
		process.exit(1);
	}

	console.log(`skills:check OK (${actionCatalog.length} action keys).`);
}

function runScaffold(skillKey) {
	if (!skillKey) {
		console.error('Usage: node scripts/discourse-skills-catalog.mjs scaffold <skill_key>');
		process.exit(1);
	}

	const actionCatalog = loadActionCatalog();
	const action = actionCatalog.find((candidate) => candidate.skillKey === skillKey);
	if (!action) {
		console.error(`Unknown skill key: ${skillKey}`);
		process.exit(1);
	}

	process.stdout.write(`${buildInstructions(action)}\n`);
}

function runRewrite() {
	const actionCatalog = loadActionCatalog();
	fs.writeFileSync(CSV_PATH, buildRefreshedCsv(actionCatalog));
	console.log(`Rewrote ${CSV_PATH} for ${actionCatalog.length} action keys.`);
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
	case 'check':
		runCheck();
		break;
	case 'scaffold':
		runScaffold(rest[0]);
		break;
	case 'rewrite':
		runRewrite();
		break;
	default:
		console.error('Usage: node scripts/discourse-skills-catalog.mjs <check|scaffold|rewrite> [skill_key]');
		process.exit(1);
}

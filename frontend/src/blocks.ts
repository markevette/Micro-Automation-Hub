import { BlockTypeName, WorkflowBlock } from './api';

/** A block being edited. `key` is a client-side identity for React lists. */
export interface DraftBlock {
  key: string;
  type: BlockTypeName;
  name: string;
  config: Record<string, unknown>;
}

export const DEFAULT_NAMES: Record<BlockTypeName, string> = {
  http_request: 'Fetch data',
  json_extract: 'Extract fields',
  filter: 'Filter',
  text_transform: 'Format text',
  notification: 'Notify',
};

export function defaultConfig(type: BlockTypeName): Record<string, unknown> {
  switch (type) {
    case 'http_request':
      return { method: 'GET', url: '', headers: {}, timeout_seconds: 10 };
    case 'json_extract':
      return { fields: {} };
    case 'filter':
      return { path: '', operator: 'eq', value: '' };
    case 'text_transform':
      return { template: '', operation: 'none' };
    case 'notification':
      return { channel: 'log', template: '' };
    default:
      return {};
  }
}

export const OPERATORS: Array<{ value: string; label: string }> = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'does not equal' },
  { value: 'gt', label: 'is greater than' },
  { value: 'gte', label: 'is greater than or equal to' },
  { value: 'lt', label: 'is less than' },
  { value: 'lte', label: 'is less than or equal to' },
  { value: 'contains', label: 'contains' },
];

export const OPERATIONS: Array<{ value: string; label: string }> = [
  { value: 'none', label: 'Leave as is' },
  { value: 'upper', label: 'UPPERCASE' },
  { value: 'lower', label: 'lowercase' },
  { value: 'strip', label: 'Trim whitespace' },
];

let counter = 0;

export function newBlock(type: BlockTypeName): DraftBlock {
  counter += 1;
  return {
    key: `draft-${counter}`,
    type,
    name: DEFAULT_NAMES[type],
    config: defaultConfig(type),
  };
}

export function toDrafts(blocks: WorkflowBlock[]): DraftBlock[] {
  return blocks.map((block) => {
    counter += 1;
    return {
      key: `draft-${counter}`,
      type: block.type,
      name: block.name,
      config: { ...block.config },
    };
  });
}

export function fromDrafts(drafts: DraftBlock[]): WorkflowBlock[] {
  return drafts.map(({ type, name, config }) => ({ type, name, config }));
}

/**
 * Filter values are typed into a text field, but the backend compares them
 * against real JSON values, so `"1000"` has to travel as the number 1000 for a
 * numeric comparison to mean what the user intended.
 */
export function coerceValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return raw;
}

export const asString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return fallback;
  return String(value);
};

export const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const asStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
    out[key] = typeof val === 'string' ? val : JSON.stringify(val);
  });
  return out;
};

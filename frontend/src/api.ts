// Baked in at build time by Create React App; see infrastructure/deployment-notes.md.
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export type RunStatus = 'success' | 'failed' | 'filtered';

export type BlockTypeName =
  | 'http_request'
  | 'json_extract'
  | 'filter'
  | 'text_transform'
  | 'notification';

export interface StepResult {
  name: string;
  type: string;
  status: RunStatus;
  output: unknown;
  error: string | null;
  duration_ms: number;
  logs: string[];
}

export interface Run {
  id: number;
  workflow_id: number | null;
  status: RunStatus;
  started_at: string;
  duration_ms: number;
  error: string | null;
  steps: StepResult[];
}

export interface WorkflowBlock {
  type: BlockTypeName;
  name: string;
  config: Record<string, unknown>;
}

export interface WorkflowDefinition {
  blocks: WorkflowBlock[];
}

export interface Workflow {
  id: number;
  name: string;
  description: string;
  definition: WorkflowDefinition;
  created_at: string;
}

export interface WorkflowInput {
  name: string;
  description: string;
  definition: WorkflowDefinition;
}

export interface BlockTypeInfo {
  type: BlockTypeName;
  label: string;
  description: string;
  config_schema: Record<string, unknown>;
}

interface ValidationIssue {
  loc?: unknown[];
  msg?: string;
}

/** Turns FastAPI's validation payload into something a person can act on. */
function formatValidationErrors(issues: ValidationIssue[]): string {
  return issues
    .slice(0, 4)
    .map((issue) => {
      // Drop the leading "body" segment; what's left points at the offending field.
      const path = Array.isArray(issue.loc)
        ? issue.loc.filter((part) => part !== 'body').join('.')
        : '';
      return path ? `${path}: ${issue.msg ?? 'invalid'}` : (issue.msg ?? 'invalid');
    })
    .join('; ');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new Error(`Could not reach the API at ${API_BASE}`);
  }

  if (!response.ok) {
    let message = `Request failed with HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') {
        message = body.detail;
      } else if (Array.isArray(body?.detail)) {
        message = formatValidationErrors(body.detail);
      }
    } catch {
      // Keep the status-based message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }
  return (await response.json()) as T;
}

export const listWorkflows = () => request<Workflow[]>('/api/workflows');

export const listBlockTypes = () => request<BlockTypeInfo[]>('/api/blocks');

export const runWorkflow = (id: number) =>
  request<Run>(`/api/workflows/${id}/run`, { method: 'POST' });

export const listRuns = (limit = 10) => request<Run[]>(`/api/runs?limit=${limit}`);

export const createWorkflow = (input: WorkflowInput) =>
  request<Workflow>('/api/workflows', { method: 'POST', body: JSON.stringify(input) });

export const updateWorkflow = (id: number, input: WorkflowInput) =>
  request<Workflow>(`/api/workflows/${id}`, { method: 'PUT', body: JSON.stringify(input) });

export const deleteWorkflow = (id: number) =>
  request<void>(`/api/workflows/${id}`, { method: 'DELETE' });

export const runAdHoc = (definition: WorkflowDefinition) =>
  request<Run>('/api/runs/ad-hoc', { method: 'POST', body: JSON.stringify(definition) });

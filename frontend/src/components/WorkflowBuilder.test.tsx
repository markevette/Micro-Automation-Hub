import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkflowBuilder from './WorkflowBuilder';
import { Workflow } from '../api';

const BLOCKS = [
  {
    type: 'http_request',
    label: 'HTTP Request',
    description: 'Calls an HTTP endpoint.',
    config_schema: { type: 'object' },
  },
  {
    type: 'filter',
    label: 'Filter',
    description: 'Stops the run unless a condition holds.',
    config_schema: { type: 'object' },
  },
];

interface Call {
  url: string;
  method: string;
  body: unknown;
}

let calls: Call[] = [];

function mockApi(overrides: { failSave?: string } = {}) {
  calls = [];
  global.fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({
      url,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });

    if (url.includes('/api/blocks')) {
      return { ok: true, status: 200, json: async () => BLOCKS };
    }
    if (url.includes('/api/runs/ad-hoc')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 9,
          workflow_id: null,
          status: 'success',
          started_at: new Date().toISOString(),
          duration_ms: 5,
          error: null,
          steps: [
            {
              name: 'Fetch data',
              type: 'http_request',
              status: 'success',
              output: { ok: true },
              error: null,
              duration_ms: 5,
              logs: ['GET https://example.com'],
            },
          ],
        }),
      };
    }
    if (overrides.failSave) {
      return {
        ok: false,
        status: 409,
        json: async () => ({ detail: overrides.failSave }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ id: 1 }) };
  }) as unknown as typeof fetch;
}

function renderBuilder(editing: Workflow | null = null) {
  const onSaved = jest.fn();
  const onCancel = jest.fn();
  render(<WorkflowBuilder editing={editing} onSaved={onSaved} onCancel={onCancel} />);
  return { onSaved, onCancel };
}

beforeEach(() => mockApi());

test('renders the block palette from the API catalogue', async () => {
  renderBuilder();

  expect(await screen.findByRole('button', { name: /HTTP Request/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Filter/ })).toBeInTheDocument();
});

test('adding a block from the palette shows its configuration fields', async () => {
  renderBuilder();

  fireEvent.click(await screen.findByRole('button', { name: /HTTP Request/ }));

  expect(screen.getByLabelText('URL')).toBeInTheDocument();
  expect(screen.getByLabelText('Method')).toBeInTheDocument();
  expect(screen.getByLabelText('Block 1 name')).toHaveValue('Fetch data');
});

test('the filter block offers the comparison operators', async () => {
  renderBuilder();

  fireEvent.click(await screen.findByRole('button', { name: /Filter/ }));

  expect(screen.getByLabelText('Field path')).toBeInTheDocument();
  expect(screen.getByLabelText('Condition')).toBeInTheDocument();
});

test('cannot save without a name or without blocks', async () => {
  renderBuilder();
  await screen.findByRole('button', { name: /HTTP Request/ });

  const save = screen.getByRole('button', { name: /create workflow/i });
  expect(save).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: /HTTP Request/ }));
  expect(screen.getByRole('button', { name: /create workflow/i })).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My flow' } });
  expect(screen.getByRole('button', { name: /create workflow/i })).toBeEnabled();
});

test('saving posts the assembled definition', async () => {
  const { onSaved } = renderBuilder();

  fireEvent.click(await screen.findByRole('button', { name: /HTTP Request/ }));
  fireEvent.change(screen.getByLabelText('URL'), {
    target: { value: 'https://example.com/data' },
  });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My flow' } });
  fireEvent.click(screen.getByRole('button', { name: /create workflow/i }));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());

  const post = calls.find((call) => call.method === 'POST' && call.url.includes('/api/workflows'));
  expect(post).toBeDefined();
  expect(post?.body).toMatchObject({
    name: 'My flow',
    definition: {
      blocks: [
        {
          type: 'http_request',
          name: 'Fetch data',
          config: { method: 'GET', url: 'https://example.com/data' },
        },
      ],
    },
  });
});

test('blocks can be reordered and removed', async () => {
  renderBuilder();

  fireEvent.click(await screen.findByRole('button', { name: /HTTP Request/ }));
  fireEvent.click(screen.getByRole('button', { name: /Filter/ }));

  expect(screen.getByLabelText('Block 1 name')).toHaveValue('Fetch data');
  expect(screen.getByLabelText('Block 2 name')).toHaveValue('Filter');

  fireEvent.click(screen.getByRole('button', { name: 'Move block 1 down' }));

  expect(screen.getByLabelText('Block 1 name')).toHaveValue('Filter');
  expect(screen.getByLabelText('Block 2 name')).toHaveValue('Fetch data');

  fireEvent.click(screen.getByRole('button', { name: 'Remove block 1' }));

  expect(screen.getByLabelText('Block 1 name')).toHaveValue('Fetch data');
  expect(screen.queryByLabelText('Block 2 name')).not.toBeInTheDocument();
});

test('a test run shows the per-block result without saving', async () => {
  renderBuilder();

  fireEvent.click(await screen.findByRole('button', { name: /HTTP Request/ }));
  fireEvent.click(screen.getByRole('button', { name: /test run/i }));

  expect(await screen.findByText(/Run #9/)).toBeInTheDocument();
  expect(calls.some((call) => call.url.includes('/api/runs/ad-hoc'))).toBe(true);
  expect(calls.some((call) => call.method === 'POST' && call.url.endsWith('/api/workflows'))).toBe(
    false
  );
});

test('editing an existing workflow preloads its blocks and saves with PUT', async () => {
  const existing: Workflow = {
    id: 4,
    name: 'Existing',
    description: 'desc',
    definition: {
      blocks: [{ type: 'filter', name: 'Gate', config: { path: 'stars', operator: 'gt', value: 10 } }],
    },
    created_at: new Date().toISOString(),
  };
  const { onSaved } = renderBuilder(existing);
  await screen.findByRole('button', { name: /HTTP Request/ });

  expect(screen.getByLabelText('Name')).toHaveValue('Existing');
  expect(screen.getByLabelText('Block 1 name')).toHaveValue('Gate');
  expect(screen.getByLabelText('Field path')).toHaveValue('stars');

  fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());

  const put = calls.find((call) => call.method === 'PUT');
  expect(put?.url).toContain('/api/workflows/4');
});

test('a rejected save surfaces the API message', async () => {
  mockApi({ failSave: 'a workflow named \u2018Existing\u2019 already exists' });
  renderBuilder();

  fireEvent.click(await screen.findByRole('button', { name: /HTTP Request/ }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Existing' } });
  fireEvent.click(screen.getByRole('button', { name: /create workflow/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/);
});

import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

const WORKFLOW = {
  id: 1,
  name: 'GitHub repo watcher',
  description: 'Fetches a repository.',
  definition: { blocks: [{ type: 'http_request', name: 'Fetch', config: {} }] },
  created_at: new Date().toISOString(),
};

const RUN = {
  id: 3,
  workflow_id: 1,
  status: 'success',
  started_at: new Date().toISOString(),
  duration_ms: 12,
  error: null,
  steps: [],
};

const BLOCK_TYPES = [
  {
    type: 'http_request',
    label: 'HTTP Request',
    description: 'Calls an HTTP endpoint.',
    config_schema: { type: 'object' },
  },
];

function mockApi({ workflows = [], runs = [] }: { workflows?: unknown[]; runs?: unknown[] } = {}) {
  global.fetch = jest.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes('/api/blocks')) {
      return { ok: true, status: 200, json: async () => BLOCK_TYPES };
    }
    if (url.includes('/api/runs')) {
      return { ok: true, status: 200, json: async () => runs };
    }
    return { ok: true, status: 200, json: async () => workflows };
  }) as unknown as typeof fetch;
}

test('renders the application heading', async () => {
  mockApi();

  render(<App />);

  expect(screen.getByRole('heading', { name: /micro automation hub/i })).toBeInTheDocument();
  // Let the initial load settle so the assertion above is not racing it.
  expect(await screen.findByText(/no workflows yet/i)).toBeInTheDocument();
});

test('shows an empty state when no workflows exist', async () => {
  mockApi();

  render(<App />);

  expect(await screen.findByText(/no workflows yet/i)).toBeInTheDocument();
});

test('lists a workflow with run, edit and delete actions', async () => {
  mockApi({ workflows: [WORKFLOW], runs: [RUN] });

  render(<App />);

  expect(await screen.findByText('GitHub repo watcher')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^run$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  expect(screen.getByText(/run #3/i)).toBeInTheDocument();
});

test('surfaces an error when the API is unreachable', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch;

  render(<App />);

  expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the api/i);
});

test('the new workflow button opens the builder', async () => {
  mockApi();
  render(<App />);
  await screen.findByText(/no workflows yet/i);

  fireEvent.click(screen.getByRole('button', { name: /new workflow/i }));

  expect(screen.getByRole('heading', { name: /new workflow/i })).toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toHaveValue('');
  // The builder loads its palette asynchronously.
  expect(await screen.findByRole('button', { name: /HTTP Request/ })).toBeInTheDocument();
});

test('editing a workflow opens the builder preloaded with it', async () => {
  mockApi({ workflows: [WORKFLOW] });
  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: /^edit$/i }));

  expect(screen.getByRole('heading', { name: /edit/i })).toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toHaveValue('GitHub repo watcher');
  expect(screen.getByLabelText('Block 1 name')).toHaveValue('Fetch');
  expect(await screen.findByRole('button', { name: /HTTP Request/ })).toBeInTheDocument();
});

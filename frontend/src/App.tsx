import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import {
  deleteWorkflow,
  listRuns,
  listWorkflows,
  Run,
  runWorkflow,
  Workflow,
} from './api';
import RunResult from './components/RunResult';
import WorkflowBuilder from './components/WorkflowBuilder';

type Mode = { view: 'list' } | { view: 'builder'; editing: Workflow | null };

function App() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ view: 'list' });

  const refresh = useCallback(async () => {
    try {
      const [loadedWorkflows, loadedRuns] = await Promise.all([listWorkflows(), listRuns()]);
      setWorkflows(loadedWorkflows);
      setRuns(loadedRuns);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRun(id: number) {
    setRunningId(id);
    setError(null);
    try {
      const run = await runWorkflow(id);
      setActiveRun(run);
      setRuns(await listRuns());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The run could not be started');
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(workflow: Workflow) {
    setError(null);
    try {
      await deleteWorkflow(workflow.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The workflow could not be deleted');
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Micro Automation Hub</h1>
          <p>Build and execute lightweight automations from configurable blocks.</p>
        </div>
        {mode.view === 'list' && (
          <button
            type="button"
            className="primary"
            onClick={() => setMode({ view: 'builder', editing: null })}
          >
            New workflow
          </button>
        )}
      </header>

      {mode.view === 'builder' ? (
        <div className="app__body app__body--wide">
          <WorkflowBuilder
            editing={mode.editing}
            onCancel={() => setMode({ view: 'list' })}
            onSaved={() => {
              setMode({ view: 'list' });
              refresh();
            }}
          />
        </div>
      ) : (
        <>
          {error && (
            <div className="alert" role="alert">
              {error}
              <button type="button" onClick={refresh}>
                Retry
              </button>
            </div>
          )}

          <main className="app__body">
            <section className="panel">
              <h2>Workflows</h2>

              {loading && <p className="muted">Loading…</p>}

              {!loading && workflows.length === 0 && (
                <p className="muted">No workflows yet. Create one to get started.</p>
              )}

              <ul className="workflows">
                {workflows.map((workflow) => (
                  <li key={workflow.id} className="workflow">
                    <div className="workflow__text">
                      <h3>{workflow.name}</h3>
                      <p>{workflow.description}</p>
                      <div className="chips">
                        {workflow.definition.blocks.map((block, index) => (
                          <span key={index} className="chip" title={block.name}>
                            {block.type}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="workflow__actions">
                      <button
                        type="button"
                        className="primary"
                        onClick={() => handleRun(workflow.id)}
                        disabled={runningId !== null}
                      >
                        {runningId === workflow.id ? 'Running…' : 'Run'}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setMode({ view: 'builder', editing: workflow })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="secondary secondary--danger"
                        onClick={() => handleDelete(workflow)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <h2>Result</h2>
              {activeRun ? (
                <RunResult run={activeRun} />
              ) : (
                <p className="muted">Run a workflow to see each block’s output here.</p>
              )}
            </section>

            <section className="panel">
              <h2>Run history</h2>
              {runs.length === 0 ? (
                <p className="muted">No runs recorded yet.</p>
              ) : (
                <ul className="history">
                  {runs.map((run) => (
                    <li key={run.id}>
                      <button
                        type="button"
                        className="link"
                        onClick={() => setActiveRun(run)}
                      >
                        <span className={`badge badge--${run.status}`}>{run.status}</span>
                        <span>Run #{run.id}</span>
                        <span className="muted">
                          {new Date(run.started_at).toLocaleTimeString()} · {run.duration_ms} ms
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </main>
        </>
      )}
    </div>
  );
}

export default App;

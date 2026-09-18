import React, { useEffect, useState } from 'react';
import {
  BlockTypeInfo,
  createWorkflow,
  listBlockTypes,
  Run,
  runAdHoc,
  updateWorkflow,
  Workflow,
} from '../api';
import { DraftBlock, fromDrafts, newBlock, toDrafts } from '../blocks';
import BlockConfigEditor from './BlockConfigEditor';
import RunResult from './RunResult';

interface Props {
  /** When present the builder edits that workflow instead of creating one. */
  editing: Workflow | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function WorkflowBuilder({ editing, onSaved, onCancel }: Props) {
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [blocks, setBlocks] = useState<DraftBlock[]>(
    editing ? toDrafts(editing.definition.blocks) : []
  );
  const [palette, setPalette] = useState<BlockTypeInfo[]>([]);
  const [testRun, setTestRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBlockTypes()
      .then(setPalette)
      .catch(() => setPalette([]));
  }, []);

  function replaceBlock(index: number, next: DraftBlock) {
    setBlocks(blocks.map((block, i) => (i === index ? next : block)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  }

  async function handleTest() {
    setBusy('test');
    setError(null);
    try {
      setTestRun(await runAdHoc({ blocks: fromDrafts(blocks) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The test run failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    setBusy('save');
    setError(null);
    try {
      const input = { name, description, definition: { blocks: fromDrafts(blocks) } };
      if (editing) {
        await updateWorkflow(editing.id, input);
      } else {
        await createWorkflow(input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The workflow could not be saved');
    } finally {
      setBusy(null);
    }
  }

  const canSave = name.trim() !== '' && blocks.length > 0 && busy === null;

  return (
    <div className="builder">
      <div className="builder__main">
        <section className="panel">
          <div className="panel__head">
            <h2>{editing ? `Edit “${editing.name}”` : 'New workflow'}</h2>
            <button type="button" className="secondary" onClick={onCancel}>
              Back
            </button>
          </div>

          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}

          <label className="field">
            <span>Name</span>
            <input
              value={name}
              placeholder="Daily status check"
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Description</span>
            <input
              value={description}
              placeholder="What does this automation do?"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </section>

        <section className="panel">
          <h2>Blocks</h2>

          {blocks.length === 0 && (
            <p className="muted">
              No blocks yet. Add one from the palette — they run top to bottom, each receiving
              the previous block’s output.
            </p>
          )}

          <ol className="builder__blocks">
            {blocks.map((block, index) => (
              <li className="builder__block" key={block.key}>
                <div className="builder__block-head">
                  <span className="step__index">{index + 1}</span>
                  <input
                    className="builder__block-name"
                    aria-label={`Block ${index + 1} name`}
                    value={block.name}
                    onChange={(event) =>
                      replaceBlock(index, { ...block, name: event.target.value })
                    }
                  />
                  <code className="step__type">{block.type}</code>
                  <div className="builder__block-actions">
                    <button
                      type="button"
                      className="icon"
                      aria-label={`Move block ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon"
                      aria-label={`Move block ${index + 1} down`}
                      disabled={index === blocks.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="icon"
                      aria-label={`Remove block ${index + 1}`}
                      onClick={() => setBlocks(blocks.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="builder__block-body">
                  <BlockConfigEditor
                    block={block}
                    onChange={(next) => replaceBlock(index, next)}
                  />
                </div>
              </li>
            ))}
          </ol>

          <div className="builder__actions">
            <button
              type="button"
              className="secondary"
              onClick={handleTest}
              disabled={blocks.length === 0 || busy !== null}
            >
              {busy === 'test' ? 'Testing…' : 'Test run'}
            </button>
            <button type="button" className="primary" onClick={handleSave} disabled={!canSave}>
              {busy === 'save' ? 'Saving…' : editing ? 'Save changes' : 'Create workflow'}
            </button>
          </div>
          {blocks.length > 0 && name.trim() === '' && (
            <p className="field__hint">Give the workflow a name to save it.</p>
          )}
        </section>

        {testRun && (
          <section className="panel">
            <h2>Test run</h2>
            <p className="field__hint">
              Test runs execute immediately and are recorded in the run history, but are not
              attached to a saved workflow.
            </p>
            <RunResult run={testRun} />
          </section>
        )}
      </div>

      <aside className="panel builder__palette">
        <h2>Add a block</h2>
        {palette.length === 0 && <p className="muted">Loading block types…</p>}
        <ul>
          {palette.map((entry) => (
            <li key={entry.type}>
              <button
                type="button"
                className="palette__item"
                onClick={() => setBlocks([...blocks, newBlock(entry.type)])}
              >
                <strong>{entry.label}</strong>
                <span>{entry.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

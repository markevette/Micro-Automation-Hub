import React from 'react';
import {
  asNumber,
  asString,
  asStringRecord,
  coerceValue,
  DraftBlock,
  OPERATIONS,
  OPERATORS,
} from '../blocks';
import KeyValueEditor from './KeyValueEditor';

interface Props {
  block: DraftBlock;
  onChange: (next: DraftBlock) => void;
}

export default function BlockConfigEditor({ block, onChange }: Props) {
  const { config } = block;

  function set(field: string, value: unknown) {
    onChange({ ...block, config: { ...config, [field]: value } });
  }

  if (block.type === 'http_request') {
    const method = asString(config.method, 'GET');
    return (
      <>
        <div className="field-row">
          <label className="field">
            <span>Method</span>
            <select value={method} onChange={(e) => set('method', e.target.value)}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </label>
          <label className="field field--grow">
            <span>URL</span>
            <input
              value={asString(config.url)}
              placeholder="https://api.example.com/resource"
              onChange={(e) => set('url', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Timeout (s)</span>
            <input
              type="number"
              min={1}
              max={60}
              value={asNumber(config.timeout_seconds, 10)}
              onChange={(e) => set('timeout_seconds', asNumber(e.target.value, 10))}
            />
          </label>
        </div>

        <KeyValueEditor
          legend="Headers"
          keyPlaceholder="Accept"
          valuePlaceholder="application/json"
          value={asStringRecord(config.headers)}
          onChange={(next) => set('headers', next)}
        />

        {method === 'POST' && (
          <label className="field">
            <span>Request body (JSON)</span>
            <textarea
              rows={3}
              value={asString(config.body)}
              placeholder='{"key": "value"}'
              onChange={(e) => set('body', e.target.value)}
            />
          </label>
        )}
      </>
    );
  }

  if (block.type === 'json_extract') {
    return (
      <KeyValueEditor
        legend="Fields"
        keyPlaceholder="stars"
        valuePlaceholder="stargazers_count"
        value={asStringRecord(config.fields)}
        onChange={(next) => set('fields', next)}
        hint="Name on the left, path into the incoming data on the right. Use dots for nesting, e.g. owner.login"
      />
    );
  }

  if (block.type === 'filter') {
    return (
      <div className="field-row">
        <label className="field field--grow">
          <span>Field path</span>
          <input
            value={asString(config.path)}
            placeholder="stars"
            onChange={(e) => set('path', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Condition</span>
          <select
            value={asString(config.operator, 'eq')}
            onChange={(e) => set('operator', e.target.value)}
          >
            {OPERATORS.map((operator) => (
              <option key={operator.value} value={operator.value}>
                {operator.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Value</span>
          <input
            value={asString(config.value)}
            placeholder="1000"
            onChange={(e) => set('value', coerceValue(e.target.value))}
          />
        </label>
      </div>
    );
  }

  if (block.type === 'text_transform') {
    return (
      <>
        <label className="field">
          <span>Template</span>
          <textarea
            rows={2}
            value={asString(config.template)}
            placeholder="{repo} has {stars} stars"
            onChange={(e) => set('template', e.target.value)}
          />
        </label>
        <p className="field__hint">
          Reference incoming fields by name in braces. <code>{'{input}'}</code> is the whole
          incoming value.
        </p>
        <label className="field">
          <span>Then</span>
          <select
            value={asString(config.operation, 'none')}
            onChange={(e) => set('operation', e.target.value)}
          >
            {OPERATIONS.map((operation) => (
              <option key={operation.value} value={operation.value}>
                {operation.label}
              </option>
            ))}
          </select>
        </label>
      </>
    );
  }

  return (
    <>
      <div className="field-row">
        <label className="field">
          <span>Channel</span>
          <select value="log" disabled onChange={() => undefined}>
            <option value="log">Application log</option>
          </select>
        </label>
      </div>
      <p className="field__hint">Email delivery is not implemented yet.</p>
      <label className="field">
        <span>Message</span>
        <textarea
          rows={2}
          value={asString(config.template)}
          placeholder="Alert -> {input}"
          onChange={(e) => set('template', e.target.value)}
        />
      </label>
    </>
  );
}

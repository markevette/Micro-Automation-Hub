import React, { useState } from 'react';

interface Props {
  legend: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  hint?: string;
}

type Row = [string, string];

/**
 * Edits a string-to-string map. Rows are held locally because a half-typed key
 * would otherwise vanish from the parent object on every keystroke.
 */
export default function KeyValueEditor({
  legend,
  keyPlaceholder,
  valuePlaceholder,
  value,
  onChange,
  hint,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() => Object.entries(value));

  function publish(next: Row[]) {
    setRows(next);
    const object: Record<string, string> = {};
    next.forEach(([key, val]) => {
      const trimmed = key.trim();
      if (trimmed !== '') object[trimmed] = val;
    });
    onChange(object);
  }

  return (
    <fieldset className="kv">
      <legend>{legend}</legend>
      {hint && <p className="field__hint">{hint}</p>}

      {rows.length === 0 && <p className="muted">None yet.</p>}

      {rows.map(([key, val], index) => (
        <div className="kv__row" key={index}>
          <input
            aria-label={`${legend} name ${index + 1}`}
            placeholder={keyPlaceholder}
            value={key}
            onChange={(event) => {
              const next = [...rows];
              next[index] = [event.target.value, val];
              publish(next);
            }}
          />
          <input
            aria-label={`${legend} value ${index + 1}`}
            placeholder={valuePlaceholder}
            value={val}
            onChange={(event) => {
              const next = [...rows];
              next[index] = [key, event.target.value];
              publish(next);
            }}
          />
          <button
            type="button"
            className="icon"
            aria-label={`Remove ${legend} row ${index + 1}`}
            onClick={() => publish(rows.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}

      <button type="button" className="secondary" onClick={() => publish([...rows, ['', '']])}>
        Add row
      </button>
    </fieldset>
  );
}

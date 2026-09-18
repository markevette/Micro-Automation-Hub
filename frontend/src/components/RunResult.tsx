import React from 'react';
import { Run, StepResult } from '../api';

const STATUS_LABEL: Record<string, string> = {
  success: 'Success',
  failed: 'Failed',
  filtered: 'Filtered out',
};

function formatOutput(output: unknown): string {
  if (output === null || output === undefined) {
    return '—';
  }
  if (typeof output === 'string') {
    return output;
  }
  return JSON.stringify(output, null, 2);
}

function Step({ step, index }: { step: StepResult; index: number }) {
  return (
    <li className={`step step--${step.status}`}>
      <div className="step__head">
        <span className="step__index">{index + 1}</span>
        <span className="step__name">{step.name}</span>
        <code className="step__type">{step.type}</code>
        <span className="step__duration">{step.duration_ms} ms</span>
      </div>

      {step.logs.length > 0 && (
        <ul className="step__logs">
          {step.logs.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      {step.error && <p className="step__error">{step.error}</p>}

      {step.status === 'success' && (
        <pre className="step__output">{formatOutput(step.output)}</pre>
      )}
    </li>
  );
}

export default function RunResult({ run }: { run: Run }) {
  const skipped = run.status !== 'success';

  return (
    <section className="run">
      <header className="run__head">
        <h3>
          Run #{run.id}
          <span className={`badge badge--${run.status}`}>
            {STATUS_LABEL[run.status] ?? run.status}
          </span>
        </h3>
        <span className="run__meta">
          {new Date(run.started_at).toLocaleString()} · {run.duration_ms} ms ·{' '}
          {run.steps.length} {run.steps.length === 1 ? 'block' : 'blocks'} executed
        </span>
      </header>

      {run.error && <p className="run__error">{run.error}</p>}

      <ol className="steps">
        {run.steps.map((step, index) => (
          <Step key={`${run.id}-${index}`} step={step} index={index} />
        ))}
      </ol>

      {skipped && (
        <p className="run__note">
          Execution stopped here, so any remaining blocks were not run.
        </p>
      )}
    </section>
  );
}

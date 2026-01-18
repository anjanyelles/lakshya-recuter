import { useMemo, useState } from 'react';
import { evaluatePasswordStrength } from './passwordStrength.js';

export default function PasswordInput({ label, value, onChange, showStrength = false }) {
  const [visible, setVisible] = useState(false);

  const strength = useMemo(() => evaluatePasswordStrength(value), [value]);

  const checklist = useMemo(
    () => [
      { key: 'minLength', text: 'At least 8 characters' },
      { key: 'uppercase', text: 'Uppercase letter (A-Z)' },
      { key: 'lowercase', text: 'Lowercase letter (a-z)' },
      { key: 'number', text: 'Number (0-9)' },
      { key: 'special', text: 'Special (!@#$%^&*)' },
      { key: 'notCommon', text: 'Not a common password' }
    ],
    []
  );

  const barWidth = `${Math.round((strength.score / 6) * 100)}%`;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label>
        {label}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            type={visible ? 'text' : 'password'}
            required
            style={{ width: '100%', padding: 10 }}
          />
          <button type="button" onClick={() => setVisible((v) => !v)} style={{ padding: '10px 12px' }}>
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>

      {showStrength ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13 }}>
            Strength: <strong>{strength.label}</strong>
          </div>
          <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: 8, width: barWidth, background: '#4f46e5' }} />
          </div>
          <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            {checklist.map((c) => (
              <div key={c.key} style={{ color: strength.checks[c.key] ? 'green' : '#555' }}>
                {strength.checks[c.key] ? '✓' : '•'} {c.text}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

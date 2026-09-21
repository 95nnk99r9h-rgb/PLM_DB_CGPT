/** Wiederverwendbare Oberflächenbausteine im hellen Apple-Stil. */
import { Children, cloneElement, isValidElement, useEffect, useId, useRef } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Icon } from './icons';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({
  titel,
  sub,
  actions,
}: {
  titel: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card-header">
      <div style={{ minWidth: 0 }}>
        <h2>{titel}</h2>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function Stat({
  wert,
  label,
  ton = '',
  onClick,
  icon = 'plan',
  hint,
}: {
  wert: ReactNode;
  label: string;
  ton?: '' | 'red' | 'orange' | 'green' | 'blue';
  onClick?: () => void;
  icon?: string;
  hint?: string;
}) {
  const inhalt = (
    <div className={`stat ${ton}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div className="stat-bottom">
        <div className="stat-value">{wert}</div>
        {onClick ? <Icon name="pfeil" size={18} /> : null}
      </div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
  if (onClick) {
    return (
      <button type="button" className="card card-click" onClick={onClick}>
        {inhalt}
      </button>
    );
  }
  return <div className="card">{inhalt}</div>;
}

export function Badge({
  children,
  ton = '',
}: {
  children: ReactNode;
  ton?: '' | 'green' | 'orange' | 'red' | 'blue' | 'purple';
}) {
  return <span className={`badge ${ton}`}>{children}</span>;
}

export function Field({
  label,
  hint,
  children,
  full = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  full?: boolean;
}) {
  const id = useId();
  let associated = false;
  const content = Children.map(children, (child, index) => {
    if (index !== 0 || !isValidElement<{ id?: string; 'aria-describedby'?: string }>(child)) return child;
    if (
      child.type === TextInput ||
      child.type === TextArea ||
      child.type === Select ||
      ['input', 'select', 'textarea'].includes(String(child.type))
    ) {
      associated = true;
      return cloneElement(child, { id, 'aria-describedby': hint ? `${id}-hint` : undefined });
    }
    return child;
  });
  return (
    <div
      className={`field ${full ? 'full' : ''}`}
      role={associated ? undefined : 'group'}
      aria-labelledby={associated ? undefined : `${id}-label`}
    >
      <label id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      {content}
      {hint ? (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input
      className="input"
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      {...rest}
    />
  );
}

export function TextArea({
  value,
  onChange,
  mono = false,
  inputRef,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  /** Zugriff auf das Feld, etwa um an der Schreibmarke einzufügen. */
  inputRef?: React.Ref<HTMLTextAreaElement>;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  return (
    <textarea
      ref={inputRef}
      className={`textarea ${mono ? 'mono' : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  id?: string;
  'aria-describedby'?: string;
}) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? 'active' : ''}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Search({
  value,
  onChange,
  placeholder = 'Suchen',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search">
      <span style={{ display: 'flex', color: 'var(--text-tertiary)' }}>
        <Icon name="suche" size={14} />
      </span>
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value ? (
        <button type="button" className="btn-icon" onClick={() => onChange('')} aria-label="Suche leeren">
          ✕
        </button>
      ) : null}
    </div>
  );
}

export function Modal({
  titel,
  sub,
  children,
  footer,
  onClose,
  wide = false,
}: {
  titel: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={sub ? `${id}-sub` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        const focusable = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length > 0);
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="modal-header">
        <div style={{ minWidth: 0 }}>
          <h2 id={`${id}-title`}>{titel}</h2>
          {sub ? (
            <div className="sub" id={`${id}-sub`}>
              {sub}
            </div>
          ) : null}
        </div>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer ? <div className="modal-footer">{footer}</div> : null}
    </dialog>
  );
}

export function EmptyState({
  icon = 'plan',
  titel,
  text,
  action,
}: {
  icon?: string;
  titel: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center' }}>
        <Icon name={icon} size={30} strokeWidth={1.3} />
      </div>
      <h3>{titel}</h3>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}

export function Progress({ wert, ton = '' }: { wert: number; ton?: '' | 'green' | 'red' }) {
  return (
    <div
      className={`progress ${ton}`}
      role="progressbar"
      aria-label="Fortschritt"
      aria-valuenow={Math.min(100, Math.max(0, wert))}
      aria-valuemin={0}
      aria-valuemax={100}
      title={`${wert}%`}
    >
      <div style={{ width: `${Math.min(100, Math.max(0, wert))}%` }} />
    </div>
  );
}

export function Avatar({ name, farbe }: { name: string; farbe?: string }) {
  const initialen = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      className="avatar"
      style={farbe ? { background: `${farbe}1f`, color: farbe } : undefined}
      title={name}
    >
      {initialen || '?'}
    </div>
  );
}

export function Callout({
  ton = '',
  icon = 'ℹ︎',
  children,
}: {
  ton?: '' | 'warn' | 'error';
  icon?: string;
  children: ReactNode;
}) {
  return (
    <div className={`callout ${ton}`}>
      <span className="callout-icon">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

export function ConfirmDialog({
  titel,
  text,
  bestaetigenLabel = 'Löschen',
  abbrechenLabel = 'Abbrechen',
  ton = 'rot',
  onConfirm,
  onClose,
}: {
  titel: string;
  text: string;
  bestaetigenLabel?: string;
  abbrechenLabel?: string;
  /** „rot“ für Löschvorgänge, „blau“ für gewöhnliche Rückfragen. */
  ton?: 'rot' | 'blau';
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      titel={titel}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {abbrechenLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={ton === 'rot' ? { background: 'var(--red)' } : undefined}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {bestaetigenLabel}
          </button>
        </>
      }
    >
      <p className="muted">{text}</p>
    </Modal>
  );
}

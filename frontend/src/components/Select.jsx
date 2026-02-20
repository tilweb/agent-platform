/**
 * Select — Zentrale Dropdown-Komponente
 *
 * Ersetzt native <select> mit einheitlichem Styling:
 * - Custom SVG Chevron (kein nativer Browser-Arrow)
 * - Konsistentes Padding/Font über alle Seiten
 * - Focus-Ring mit borderFocus
 *
 * Usage:
 *   <Select value={v} onChange={handler} options={[{ value: 'a', label: 'A' }]} />
 *   <Select value={v} onChange={handler}><option value="a">A</option></Select>
 */

import { theme } from '../config/theme';

const selectStyle = {
  width: '100%',
  padding: `${theme.spacing.md} ${theme.spacing.lg}`,
  paddingRight: '2.5rem',
  borderRadius: theme.borderRadius.lg,
  border: `1px solid ${theme.colors.border}`,
  fontSize: theme.typography.sizes.base,
  fontFamily: 'inherit',
  backgroundColor: theme.colors.background,
  color: theme.colors.text,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  cursor: 'pointer',
  outline: 'none',
  transition: `border-color ${theme.transitions.fast}`,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: `right ${theme.spacing.md} center`,
  backgroundSize: '16px',
};

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  style = {},
  children,
  ...rest
}) {
  const handleFocus = (e) => {
    e.currentTarget.style.borderColor = theme.colors.borderFocus;
  };

  const handleBlur = (e) => {
    e.currentTarget.style.borderColor = theme.colors.border;
  };

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{
        ...selectStyle,
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        ...style,
      }}
      {...rest}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
}

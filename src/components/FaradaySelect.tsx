import { fieldStyles } from "./formStyles";

export interface FaradaySelectOption {
  label: string;
  value: string;
}

export interface FaradaySelectProps {
  name: string;
  label?: string;
  options: FaradaySelectOption[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}

export function FaradaySelect({
  name,
  label,
  options,
  defaultValue,
  required,
  placeholder,
}: FaradaySelectProps) {
  return (
    <div style={fieldStyles.row}>
      {label && (
        <label htmlFor={`faraday-field-${name}`} style={fieldStyles.label}>
          {label}
          {required && <span style={fieldStyles.requiredMark}> *</span>}
        </label>
      )}
      <select
        id={`faraday-field-${name}`}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        style={fieldStyles.input}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

import { fieldStyles } from "./formStyles";

export interface FaradayTextareaProps {
  name: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  rows?: number;
  required?: boolean;
}

export function FaradayTextarea({
  name,
  label,
  placeholder,
  defaultValue,
  rows = 4,
  required,
}: FaradayTextareaProps) {
  return (
    <div style={fieldStyles.row}>
      {label && (
        <label htmlFor={`faraday-field-${name}`} style={fieldStyles.label}>
          {label}
          {required && <span style={fieldStyles.requiredMark}> *</span>}
        </label>
      )}
      <textarea
        id={`faraday-field-${name}`}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        rows={rows}
        required={required}
        style={fieldStyles.textarea}
      />
    </div>
  );
}

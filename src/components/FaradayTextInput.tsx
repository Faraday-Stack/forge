import { fieldStyles } from "./formStyles";

export interface FaradayTextInputProps {
  name: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

export function FaradayTextInput({
  name,
  label,
  placeholder,
  defaultValue,
  required,
}: FaradayTextInputProps) {
  return (
    <div style={fieldStyles.row}>
      {label && (
        <label htmlFor={`faraday-field-${name}`} style={fieldStyles.label}>
          {label}
          {required && <span style={fieldStyles.requiredMark}> *</span>}
        </label>
      )}
      <input
        id={`faraday-field-${name}`}
        type="text"
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        style={fieldStyles.input}
      />
    </div>
  );
}

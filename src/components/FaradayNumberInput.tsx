import { fieldStyles } from "./formStyles";

export interface FaradayNumberInputProps {
  name: string;
  label?: string;
  placeholder?: string;
  defaultValue?: number | string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export function FaradayNumberInput({
  name,
  label,
  placeholder,
  defaultValue,
  required,
  min,
  max,
  step,
}: FaradayNumberInputProps) {
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
        type="number"
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        step={step}
        style={fieldStyles.input}
      />
    </div>
  );
}

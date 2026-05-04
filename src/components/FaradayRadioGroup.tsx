import { fieldStyles } from "./formStyles";

export interface FaradayRadioOption {
  label: string;
  value: string;
}

export interface FaradayRadioGroupProps {
  name: string;
  label?: string;
  options: FaradayRadioOption[];
  defaultValue?: string;
  required?: boolean;
}

export function FaradayRadioGroup({
  name,
  label,
  options,
  defaultValue,
  required,
}: FaradayRadioGroupProps) {
  return (
    <div style={fieldStyles.radioGroup} role="radiogroup" aria-label={label}>
      {label && (
        <div style={fieldStyles.label}>
          {label}
          {required && <span style={fieldStyles.requiredMark}> *</span>}
        </div>
      )}
      {options.map((opt) => (
        <label key={opt.value} style={fieldStyles.radioOption}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            defaultChecked={defaultValue === opt.value}
            required={required}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

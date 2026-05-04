import { fieldStyles } from "./formStyles";

export interface FaradayCheckboxProps {
  name: string;
  label: string;
  defaultChecked?: boolean;
  required?: boolean;
  /** Submitted value when checked. Defaults to "on" (browser default). */
  value?: string;
}

export function FaradayCheckbox({
  name,
  label,
  defaultChecked,
  required,
  value,
}: FaradayCheckboxProps) {
  return (
    <label style={fieldStyles.inlineRow}>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        required={required}
        value={value}
      />
      <span>
        {label}
        {required && <span style={fieldStyles.requiredMark}> *</span>}
      </span>
    </label>
  );
}

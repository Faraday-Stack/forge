import type React from "react";
import type { ComponentRegistryEntry } from "../types";
import { FaradayBanner } from "./FaradayBanner";
import { FaradayCard } from "./FaradayCard";
import { FaradayBadge } from "./FaradayBadge";
import { FaradayToast } from "./FaradayToast";
import { FaradayText } from "./FaradayText";
import { FaradayForm } from "./FaradayForm";
import { FaradayTextInput } from "./FaradayTextInput";
import { FaradayTextarea } from "./FaradayTextarea";
import { FaradaySelect } from "./FaradaySelect";
import { FaradayCheckbox } from "./FaradayCheckbox";
import { FaradayRadioGroup } from "./FaradayRadioGroup";
import { FaradayNumberInput } from "./FaradayNumberInput";
import { FaradayEmailInput } from "./FaradayEmailInput";

export { FaradayBanner } from "./FaradayBanner";
export type { FaradayBannerProps } from "./FaradayBanner";
export { FaradayCard } from "./FaradayCard";
export type { FaradayCardProps } from "./FaradayCard";
export { FaradayBadge } from "./FaradayBadge";
export type { FaradayBadgeProps } from "./FaradayBadge";
export { FaradayToast } from "./FaradayToast";
export type { FaradayToastProps } from "./FaradayToast";
export { FaradayText } from "./FaradayText";
export type { FaradayTextProps } from "./FaradayText";
export { FaradayForm } from "./FaradayForm";
export type { FaradayFormProps } from "./FaradayForm";
export { FaradayTextInput } from "./FaradayTextInput";
export type { FaradayTextInputProps } from "./FaradayTextInput";
export { FaradayTextarea } from "./FaradayTextarea";
export type { FaradayTextareaProps } from "./FaradayTextarea";
export { FaradaySelect } from "./FaradaySelect";
export type { FaradaySelectProps, FaradaySelectOption } from "./FaradaySelect";
export { FaradayCheckbox } from "./FaradayCheckbox";
export type { FaradayCheckboxProps } from "./FaradayCheckbox";
export { FaradayRadioGroup } from "./FaradayRadioGroup";
export type {
  FaradayRadioGroupProps,
  FaradayRadioOption,
} from "./FaradayRadioGroup";
export { FaradayNumberInput } from "./FaradayNumberInput";
export type { FaradayNumberInputProps } from "./FaradayNumberInput";
export { FaradayEmailInput } from "./FaradayEmailInput";
export type { FaradayEmailInputProps } from "./FaradayEmailInput";

const asAny = <P,>(c: React.ComponentType<P>) =>
  c as unknown as React.ComponentType<Record<string, unknown>>;

export const DEFAULT_COMPONENTS: Record<string, ComponentRegistryEntry> = {
  FaradayText: {
    component: asAny(FaradayText),
    propsSchema: {
      text: "string (required) — the text content",
      as: "string — one of: p, h1, h2, h3, h4, span (default: p)",
      color: "string — CSS color value",
      fontSize: "string — CSS font-size value (e.g. '18px', '1.2rem')",
      fontWeight: "string — CSS font-weight value (e.g. '400', '600', 'bold')",
      textAlign: "string — one of: left, center, right",
    },
  },
  FaradayBanner: {
    component: asAny(FaradayBanner),
    propsSchema: {
      message: "string (required) — the banner text",
      title: "string — optional bold heading above the message",
      variant: "string — one of: info, warning, error, success (default: info)",
      dismissible: "boolean — show a close button (default: false)",
    },
  },
  FaradayCard: {
    component: asAny(FaradayCard),
    propsSchema: {
      title: "string — card heading",
      body: "string — card body text",
      cta: "string — call-to-action button label",
      ctaHref: "string — URL for the CTA button",
      variant: "string — one of: default, outlined, filled (default: default)",
    },
  },
  FaradayBadge: {
    component: asAny(FaradayBadge),
    propsSchema: {
      label: "string (required) — badge text",
      variant:
        "string — one of: primary, secondary, success, warning, error (default: secondary)",
    },
  },
  FaradayToast: {
    component: asAny(FaradayToast),
    propsSchema: {
      message: "string (required) — toast notification text",
      title: "string — optional bold heading",
      variant: "string — one of: info, warning, error, success (default: info)",
      duration:
        "number — auto-dismiss after N milliseconds; 0 = persistent (default: 4000)",
    },
  },
  FaradayForm: {
    component: asAny(FaradayForm),
    propsSchema: {
      formId:
        "string (required) — unique id; the form auto-registers a Modifiable container with this id, into which you should insertComponent the form's fields",
      title: "string — bold heading rendered above the fields",
      submitLabel: "string — text on the submit button (default: 'Submit')",
      successMessage:
        "string — message shown next to the button after a successful submit (default: 'Thanks!')",
    },
  },
  FaradayTextInput: {
    component: asAny(FaradayTextInput),
    propsSchema: {
      name:
        "string (required) — the FormData key under which this field's value will be submitted",
      label: "string — label rendered above the input",
      placeholder: "string — placeholder text shown when empty",
      defaultValue: "string — initial value",
      required: "boolean — make the field required (default: false)",
    },
  },
  FaradayTextarea: {
    component: asAny(FaradayTextarea),
    propsSchema: {
      name: "string (required) — the FormData key for this field's value",
      label: "string — label rendered above the textarea",
      placeholder: "string — placeholder text shown when empty",
      defaultValue: "string — initial value",
      rows: "number — number of visible text rows (default: 4)",
      required: "boolean — make the field required (default: false)",
    },
  },
  FaradaySelect: {
    component: asAny(FaradaySelect),
    propsSchema: {
      name: "string (required) — the FormData key for this field's value",
      label: "string — label rendered above the select",
      options:
        "array (required) — list of { label: string, value: string } option objects",
      defaultValue: "string — value of the option to select initially",
      placeholder:
        "string — disabled prompt option shown first when no defaultValue is set",
      required: "boolean — make the field required (default: false)",
    },
  },
  FaradayCheckbox: {
    component: asAny(FaradayCheckbox),
    propsSchema: {
      name: "string (required) — the FormData key for this field's value",
      label: "string (required) — label text shown next to the checkbox",
      defaultChecked: "boolean — initial checked state (default: false)",
      value:
        "string — value submitted when checked (default: 'on'; standard HTML)",
      required: "boolean — make the field required (default: false)",
    },
  },
  FaradayRadioGroup: {
    component: asAny(FaradayRadioGroup),
    propsSchema: {
      name:
        "string (required) — the FormData key shared by all radios in the group",
      label: "string — label rendered above the group",
      options:
        "array (required) — list of { label: string, value: string } option objects",
      defaultValue: "string — value of the radio to select initially",
      required: "boolean — make the field required (default: false)",
    },
  },
  FaradayNumberInput: {
    component: asAny(FaradayNumberInput),
    propsSchema: {
      name: "string (required) — the FormData key for this field's value",
      label: "string — label rendered above the input",
      placeholder: "string — placeholder text shown when empty",
      defaultValue: "number — initial value",
      min: "number — minimum allowed value",
      max: "number — maximum allowed value",
      step: "number — step increment for spinner / validation",
      required: "boolean — make the field required (default: false)",
    },
  },
  FaradayEmailInput: {
    component: asAny(FaradayEmailInput),
    propsSchema: {
      name: "string (required) — the FormData key for this field's value",
      label: "string — label rendered above the input",
      placeholder: "string — placeholder text shown when empty",
      defaultValue: "string — initial value",
      required: "boolean — make the field required (default: false)",
    },
  },
};

import type { ComponentRegistryEntry } from "../types";
import { FaradayBanner } from "./FaradayBanner";
import { FaradayCard } from "./FaradayCard";
import { FaradayBadge } from "./FaradayBadge";
import { FaradayToast } from "./FaradayToast";

export { FaradayBanner } from "./FaradayBanner";
export type { FaradayBannerProps } from "./FaradayBanner";
export { FaradayCard } from "./FaradayCard";
export type { FaradayCardProps } from "./FaradayCard";
export { FaradayBadge } from "./FaradayBadge";
export type { FaradayBadgeProps } from "./FaradayBadge";
export { FaradayToast } from "./FaradayToast";
export type { FaradayToastProps } from "./FaradayToast";

export const DEFAULT_COMPONENTS: Record<string, ComponentRegistryEntry> = {
  FaradayBanner: {
    component: FaradayBanner as unknown as React.ComponentType<Record<string, unknown>>,
    propsSchema: {
      message: "string (required) — the banner text",
      title: "string — optional bold heading above the message",
      variant: "string — one of: info, warning, error, success (default: info)",
      dismissible: "boolean — show a close button (default: false)",
    },
  },
  FaradayCard: {
    component: FaradayCard as unknown as React.ComponentType<Record<string, unknown>>,
    propsSchema: {
      title: "string — card heading",
      body: "string — card body text",
      cta: "string — call-to-action button label",
      ctaHref: "string — URL for the CTA button",
      variant: "string — one of: default, outlined, filled (default: default)",
    },
  },
  FaradayBadge: {
    component: FaradayBadge as unknown as React.ComponentType<Record<string, unknown>>,
    propsSchema: {
      label: "string (required) — badge text",
      variant:
        "string — one of: primary, secondary, success, warning, error (default: secondary)",
    },
  },
  FaradayToast: {
    component: FaradayToast as unknown as React.ComponentType<Record<string, unknown>>,
    propsSchema: {
      message: "string (required) — toast notification text",
      title: "string — optional bold heading",
      variant: "string — one of: info, warning, error, success (default: info)",
      duration:
        "number — auto-dismiss after N milliseconds; 0 = persistent (default: 4000)",
    },
  },
};

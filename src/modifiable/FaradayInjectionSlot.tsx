import { useStore } from "zustand";
import { useAgentStore } from "../provider/context";
import type { InjectionPosition } from "../types";

interface FaradayInjectionSlotProps {
  /** Id of the registered Modifiable this slot belongs to. */
  targetId: string;
  /**
   * Which slice of injections to render. Drop one slot per position your host
   * element wants to honor:
   * - `before` — sibling rendered before the host element
   * - `inside-start` — first child of the host element
   * - `inside-end` — last child of the host element
   * - `after` — sibling rendered after the host element
   */
  position: InjectionPosition;
}

/**
 * Renders agent-injected HTML/SVG anchored to a registered element. Lets hosts
 * that aren't using `<Modifiable>` (e.g. pre-existing wrappers like Midday's
 * `DraggableChartCard`) still receive injections — drop one of these in each
 * position you want to honor:
 *
 * ```tsx
 * useModifiable(id, { type: "container" });
 * return (
 *   <>
 *     <FaradayInjectionSlot targetId={id} position="before" />
 *     <div id={id}>
 *       <FaradayInjectionSlot targetId={id} position="inside-start" />
 *       {children}
 *       <FaradayInjectionSlot targetId={id} position="inside-end" />
 *     </div>
 *     <FaradayInjectionSlot targetId={id} position="after" />
 *   </>
 * );
 * ```
 *
 * Renders nothing when no injections target this id+position. Markup is
 * already sanitized server-side by the store before reaching here.
 */
export function FaradayInjectionSlot({
  targetId,
  position,
}: FaradayInjectionSlotProps) {
  const store = useAgentStore();
  const injections = useStore(store, (s) => s.injections[targetId] ?? []);
  const matching = injections.filter((i) => i.position === position);

  if (matching.length === 0) return null;

  // For `before`/`after` (sibling positions), wrap each injection in a real
  // block element that spans the full width of any CSS Grid / Flex parent.
  // Without this the injected DOM would land in a 1/12 grid cell next to the
  // host card and look squished.
  // For `inside-start`/`inside-end`, keep `display: contents` so the markup
  // flows naturally inside the host's existing layout.
  const isSibling = position === "before" || position === "after";

  return (
    <>
      {matching.map((i) =>
        isSibling ? (
          <div
            key={i.injectionId}
            data-faraday-injection={i.injectionId}
            style={{
              gridColumn: "1 / -1",
              flexBasis: "100%",
              width: "100%",
            }}
            dangerouslySetInnerHTML={{ __html: i.html }}
          />
        ) : (
          <span
            key={i.injectionId}
            data-faraday-injection={i.injectionId}
            style={{ display: "contents" }}
            dangerouslySetInnerHTML={{ __html: i.html }}
          />
        ),
      )}
    </>
  );
}

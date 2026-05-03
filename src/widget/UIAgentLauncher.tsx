/**
 * @deprecated Kept as a no-op for backward-compatibility with demos that mounted
 * the floating chat panel manually. The new inline-edit overlay is auto-mounted
 * by `UIAgentProvider`, so you no longer need to render anything yourself.
 *
 * Safe to remove `<UIAgentLauncher />` from your tree.
 */
export function UIAgentLauncher(_props?: { position?: string }): null {
  return null;
}

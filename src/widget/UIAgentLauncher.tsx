/**
 * @deprecated The launcher (orange-dot chat trigger) is now auto-mounted by
 * `UIAgentProvider`. This component is a no-op kept only so older host apps
 * that explicitly imported `<UIAgentLauncher />` keep compiling. Remove the
 * import and the JSX usage when convenient.
 */
export function UIAgentLauncher(): null {
  return null;
}

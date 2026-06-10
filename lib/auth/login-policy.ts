export function canIssueSessionForUser(
  user: { isActive: boolean } | null | undefined,
): user is { isActive: true } {
  return Boolean(user?.isActive);
}

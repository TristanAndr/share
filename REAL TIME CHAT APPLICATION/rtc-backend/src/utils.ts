/**
 * Génère un nom de salon unique pour deux utilisateurs (DM).
 * Les IDs sont triés pour garantir que dmRoom(1, 2) === dmRoom(2, 1).
 */
export function dmRoom(a: number, b: number): string {
  return `dm:${Math.min(a, b)}-${Math.max(a, b)}`;
}

/**
 * Retourne la liste des utilisateurs uniques en ligne sur un serveur.
 */
export function getUniqueOnlineUsers(serverOnlineMap: Map<number, Map<string, { userId: number; username: string }>>, serverId: number) {
  const m = serverOnlineMap.get(serverId);
  if (!m) return [];
  const seen = new Set<number>();
  const users: { userId: number; username: string }[] = [];
  for (const u of m.values()) {
    if (!seen.has(u.userId)) {
      seen.add(u.userId);
      users.push(u);
    }
  }
  return users;
}

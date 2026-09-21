/** Collision-resistant IDs; no backend or account information is encoded. */
export function newId(prefix = 'id'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

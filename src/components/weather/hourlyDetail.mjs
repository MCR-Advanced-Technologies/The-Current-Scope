export function getHourlyDetailPoint(hours, index) {
  if (!Array.isArray(hours) || !hours.length) return null;
  const safeIndex = Number(index);
  if (!Number.isFinite(safeIndex)) return null;
  if (safeIndex < 0 || safeIndex >= hours.length) return null;
  const row = hours[safeIndex];
  return row && typeof row === "object" ? row : null;
}
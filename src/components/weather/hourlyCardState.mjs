export function getHourlyForecastCardState({ hours, loading, error } = {}) {
  if (loading) return "loading";
  if (error) return "error";
  if (Array.isArray(hours) && hours.length > 0) return "ready";
  return "empty";
}

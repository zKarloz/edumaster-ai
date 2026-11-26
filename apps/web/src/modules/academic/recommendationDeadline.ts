/** Calcula duración absoluta desde fechas ISO con zona; no compara horas locales. */
export function remainingTime(due: string | null, now: number, language: string) {
  if (!due || !/(Z|[+-]\d{2}:\d{2})$/i.test(due)) return null;
  const ms = Date.parse(due) - now;
  if (!Number.isFinite(ms)) return null;
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  const rest = minutes % 60;
  const format = (value: number, unit: 'day' | 'hour' | 'minute') =>
    new Intl.NumberFormat(language, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
  const label = [days ? format(days, 'day') : '', hours ? format(hours, 'hour') : '', rest || !minutes ? format(rest, 'minute') : ''].filter(Boolean).join(' · ');
  return { expired: ms < 0, high: ms <= 48 * 3600000, label };
}

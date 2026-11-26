/** Datos ficticios en céntimos; nunca se conectan a matrículas ni pagos reales. */
export const concepts = ['enrollment', 'monthly', 'course', 'certificate'] as const;
export type Concept = typeof concepts[number];
export type Income = { id: string; concept: Concept; cents: number; date: string; paid: boolean };
export const demoMonth = '2026-11';
export const seedIncome: Income[] = [
  { id: 'DEMO-001', concept: 'enrollment', cents: 15000, date: '2026-11-03', paid: true },
  { id: 'DEMO-002', concept: 'monthly', cents: 30000, date: '2026-11-07', paid: true },
  { id: 'DEMO-003', concept: 'course', cents: 20000, date: '2026-11-12', paid: true },
  { id: 'DEMO-004', concept: 'certificate', cents: 8000, date: '2026-11-15', paid: false },
  { id: 'DEMO-005', concept: 'monthly', cents: 30000, date: '2026-11-20', paid: false },
  { id: 'DEMO-006', concept: 'course', cents: 25000, date: '2026-10-10', paid: true },
];
export function summarize(rows: readonly Income[]) {
  return rows.reduce((s, r) => ({ paid: s.paid + (r.paid ? r.cents : 0), pending: s.pending + (r.paid ? 0 : r.cents), count: s.count + Number(r.paid) }), { paid: 0, pending: 0, count: 0 });
}
export function amountToCents(value: string): number | null {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole = '', fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 ? cents : null;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}

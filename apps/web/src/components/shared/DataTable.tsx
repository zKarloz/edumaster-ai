// Tabla compartida con búsqueda y paginación local, lista para API paginada.
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export interface Column<T> {
  header: string;
  key: keyof T;
  render?: (item: T) => ReactNode;
}
interface DataTableProps<T extends object> {
  rows: T[];
  columns: Column<T>[];
  label: string;
  pageSize?: number;
  // Cuando la API realiza búsqueda/paginación, no dupliquemos controles locales.
  manualMode?: boolean;
}
export function DataTable<T extends object>({ rows, columns, label, pageSize = 5, manualMode = false }: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => manualMode ? rows : rows.filter(item =>
    Object.values(item).some(value => String(value ?? '').toLowerCase().includes(search.toLowerCase()))
  ), [rows, search, manualMode]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = manualMode ? filtered : filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return (
    <section className="app-table overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#23456A] dark:bg-[#0A1F3D]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-[#23456A]">
        <h3 className="font-semibold">{label}</h3>
        {!manualMode && <label className="search-control flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600">
          <Search size={15} aria-hidden="true" className="text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-44 min-w-0 border-0 bg-transparent outline-none focus:outline-none focus-visible:outline-none placeholder:text-slate-400" placeholder="Buscar..." aria-label={`Buscar en ${label}`} />
        </label>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-[#102C4F] dark:text-slate-300">
            <tr>{columns.map(col => <th key={String(col.key)} scope="col" className="px-5 py-3 font-medium">{col.header}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((item, i) => <tr key={i} className="border-t border-slate-100 dark:border-[#23456A]">
              {columns.map(col => <td key={String(col.key)} className="px-5 py-3">
                {col.render ? col.render(item) : String(item[col.key] ?? '')}
              </td>)}
            </tr>)}
          </tbody>
        </table>
        {visible.length === 0 && <p className="app-meta-text px-5 py-8 text-center text-slate-500">No hay resultados para esta búsqueda.</p>}
      </div>
      {!manualMode && <footer className="app-table-footer flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-[#23456A] dark:text-slate-300">
        <span>{filtered.length} registros · Página {currentPage + 1} de {totalPages}</span>
        <div className="flex gap-2">
          <button type="button" aria-label="Página anterior" disabled={currentPage === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="app-pagination-button rounded-lg border border-slate-200 p-2 disabled:opacity-30 dark:border-slate-600"><ChevronLeft size={16}/></button>
          <button type="button" aria-label="Página siguiente" disabled={currentPage >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="app-pagination-button rounded-lg border border-slate-200 p-2 disabled:opacity-30 dark:border-slate-600"><ChevronRight size={16}/></button>
        </div>
      </footer>}
    </section>
  );
}

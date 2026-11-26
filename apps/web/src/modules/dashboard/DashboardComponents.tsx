/** Tarjetas y paneles reutilizables para todos los roles. */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
export function Panel({title,children}:{title:string;children:ReactNode}) {return <section className="app-panel rounded-2xl border p-5 space-y-4"><h3 className="font-semibold">{title}</h3>{children}</section>}
export function Stat({title,value,Icon,hint}:{title:string;value:string|number|null|undefined;Icon:LucideIcon;hint?:string}) {return <section className="app-panel app-indicator-card rounded-2xl border p-5"><div className="flex justify-between gap-2"><span className="app-muted text-sm">{title}</span><Icon size={22} className="app-accent shrink-0"/></div><p className="mt-3 text-2xl font-semibold tabular-nums">{value??'—'}</p>{hint&&<p className="app-muted mt-2 text-xs">{hint}</p>}</section>}

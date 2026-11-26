/** Maquetado interactivo, aislado del backend y de la información financiera real. */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Clock, CheckCircle2, Plus, RotateCcw, ChartColumn } from 'lucide-react';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Modal } from '../../components/shared/Modal';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { useToast } from '../../components/shared/Toast';
import { concepts, demoMonth, seedIncome, summarize, amountToCents, validDate, type Concept, type Income } from './demoIncome';

const copy = {
 es: {title:'Ingresos institucionales',notice:'DEMO · Datos ficticios. No registra pagos reales ni guarda información en Supabase. Los cambios se pierden al salir.',paid:'Ingresos recibidos',pending:'Importe pendiente',count:'Pagos recibidos',total:'Total registrado',chart:'Ingresos por concepto',list:'Movimientos de demostración',add:'Registrar ingreso DEMO',reset:'Restablecer DEMO',period:'Período',month:'Noviembre 2026',year:'Año 2026',all:'Todos los períodos',concept:'Concepto',amount:'Importe (PEN)',date:'Fecha',status:'Estado',yes:'Pagado',no:'Pendiente',action:'Acción',mark:'Simular pago',saved:'Movimiento DEMO registrado.',marked:'Pago simulado.',restored:'Datos DEMO restablecidos.',invalid:'Introduce un importe positivo con hasta dos decimales y una fecha válida.',cancel:'Cancelar',save:'Guardar simulación',enrollment:'Matrículas',monthly:'Mensualidades',course:'Venta de cursos',certificate:'Certificaciones'},
 en: {title:'Institutional income',notice:'DEMO · Fictional data. No real payments or Supabase storage. Changes disappear when leaving.',paid:'Income received',pending:'Outstanding amount',count:'Payments received',total:'Total recorded',chart:'Income by category',list:'Demo transactions',add:'Record DEMO income',reset:'Reset DEMO',period:'Period',month:'November 2026',year:'Year 2026',all:'All periods',concept:'Category',amount:'Amount (PEN)',date:'Date',status:'Status',yes:'Paid',no:'Pending',action:'Action',mark:'Simulate payment',saved:'DEMO transaction recorded.',marked:'Payment simulated.',restored:'DEMO data reset.',invalid:'Enter a positive amount with up to two decimals and a valid date.',cancel:'Cancel',save:'Save simulation',enrollment:'Enrollments',monthly:'Monthly fees',course:'Course sales',certificate:'Certificates'},
 pt: {title:'Receitas institucionais',notice:'DEMO · Dados fictícios. Não registra pagamentos reais nem salva no Supabase. Alterações se perdem ao sair.',paid:'Receitas recebidas',pending:'Valor pendente',count:'Pagamentos recebidos',total:'Total registrado',chart:'Receitas por categoria',list:'Movimentos de demonstração',add:'Registrar receita DEMO',reset:'Restaurar DEMO',period:'Período',month:'Novembro 2026',year:'Ano 2026',all:'Todos os períodos',concept:'Categoria',amount:'Valor (PEN)',date:'Data',status:'Estado',yes:'Pago',no:'Pendente',action:'Ação',mark:'Simular pagamento',saved:'Movimento DEMO registrado.',marked:'Pagamento simulado.',restored:'Dados DEMO restaurados.',invalid:'Informe um valor positivo com até duas casas decimais e uma data válida.',cancel:'Cancelar',save:'Salvar simulação',enrollment:'Matrículas',monthly:'Mensalidades',course:'Venda de cursos',certificate:'Certificações'},
};
export function IncomeDemoPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('pt') ? 'pt' : i18n.language.startsWith('en') ? 'en' : 'es';
  const c = copy[lang];
  const money = (n:number) => new Intl.NumberFormat(lang==='es'?'es-PE':lang==='pt'?'pt-BR':'en-US',{style:'currency',currency:'PEN'}).format(n/100);
  const {notify} = useToast();
  const [rows,setRows] = useState<Income[]>(()=>[...seedIncome]);
  const [period,setPeriod] = useState('month');
  const [open,setOpen] = useState(false);
  const [concept,setConcept] = useState<Concept>('enrollment');
  const [amount,setAmount] = useState('');
  const [date,setDate] = useState(`${demoMonth}-26`);
  const [paid,setPaid] = useState(true);
  const visible = rows.filter(r=>period==='all'||r.date.startsWith(period==='month'?demoMonth:'2026'));
  const totals = summarize(visible);
  const options = concepts.map(value=>({value,label:c[value]}));
  function submit(e:FormEvent) {
    e.preventDefault();
    const cents=amountToCents(amount);
    if(cents===null||!validDate(date)){notify(c.invalid);return;}
    setRows(old=>[{id:`DEMO-${crypto.randomUUID()}`,concept,cents,date,paid},...old]);
    setPeriod('all');setOpen(false);notify(c.saved,'success');
  }
  const columns:Column<Income>[] = [
    {header:c.concept,key:'concept',render:r=>c[r.concept]},
    {header:c.date,key:'date',render:r=>new Intl.DateTimeFormat(lang,{timeZone:'UTC'}).format(new Date(`${r.date}T00:00:00Z`))},
    {header:c.amount,key:'cents',render:r=>money(r.cents)},
    {header:c.status,key:'paid',render:r=><span className={`rounded-md border px-2 py-1 text-xs font-medium ${r.paid?'income-paid':'app-warning'}`}>{r.paid?c.yes:c.no}</span>},
    {header:c.action,key:'id',render:r=>!r.paid?<button type="button" className="app-secondary-button rounded-lg border px-3 py-2 text-xs" onClick={()=>{setRows(old=>old.map(x=>x.id===r.id?{...x,paid:true}:x));notify(c.marked,'success');}}>{c.mark}</button>:'—'},
  ];
  return <div className="space-y-5">
    <div className="app-warning rounded-xl border p-4 text-sm" role="note">{c.notice}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-semibold"><Wallet size={23}/>{c.title}</h2><div className="flex flex-wrap gap-2"><button className="app-secondary-button flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={()=>{setRows([...seedIncome]);setPeriod('month');notify(c.restored);}}><RotateCcw size={16}/>{c.reset}</button><button className="app-primary-button flex items-center gap-2 rounded-lg px-3 py-2 text-sm" onClick={()=>{setAmount('');setOpen(true);}}><Plus size={16}/>{c.add}</button></div></div>
    <div className="max-w-xs"><OptionSelect ariaLabel={c.period} value={period} onChange={setPeriod} options={[{value:'month',label:c.month},{value:'year',label:c.year},{value:'all',label:c.all}]}/></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:c.paid,value:money(totals.paid),Icon:Wallet},{label:c.pending,value:money(totals.pending),Icon:Clock},{label:c.count,value:String(totals.count),Icon:CheckCircle2},{label:c.total,value:money(totals.paid+totals.pending),Icon:ChartColumn}].map(({label,value,Icon})=><section key={label} className="app-panel rounded-2xl border p-4"><Icon size={21} className="app-accent mb-3"/><p className="app-muted text-sm">{label}</p><p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p></section>)}</div>
    <section className="app-panel rounded-2xl border p-5"><h3 className="mb-5 font-semibold">{c.chart}</h3><div className="space-y-4">{concepts.map(k=>{const n=summarize(visible.filter(r=>r.concept===k)).paid;return <div key={k}><div className="mb-1 flex justify-between gap-2 text-sm"><span>{c[k]}</span><span className="tabular-nums">{money(n)}</span></div><div className="h-3 overflow-hidden rounded-full" style={{background:'var(--app-control-hover)'}}><div className="h-full rounded-full bg-sky-500" style={{width:`${totals.paid?n/totals.paid*100:0}%`}}/></div></div>})}</div></section>
    <DataTable rows={visible} columns={columns} label={c.list}/>
    <Modal open={open} title={c.add} onClose={()=>setOpen(false)} mobileSheet><form onSubmit={submit} className="space-y-4"><label className="block text-sm">{c.concept}</label><OptionSelect ariaLabel={c.concept} value={concept} onChange={v=>setConcept(v as Concept)} options={options}/><label className="block text-sm">{c.amount}<input className="app-input mt-1 block w-full rounded-lg border p-2" inputMode="decimal" required value={amount} onChange={e=>setAmount(e.target.value.replace(',','.'))}/></label><label className="block text-sm">{c.date}<input type="date" className="app-input mt-1 block w-full rounded-lg border p-2" required value={date} onChange={e=>setDate(e.target.value)}/></label><label className="block text-sm">{c.status}</label><OptionSelect ariaLabel={c.status} value={paid?'paid':'pending'} onChange={v=>setPaid(v==='paid')} options={[{value:'paid',label:c.yes},{value:'pending',label:c.no}]}/><div className="flex justify-end gap-2"><button type="button" className="app-secondary-button rounded-lg border px-4 py-2" onClick={()=>setOpen(false)}>{c.cancel}</button><button type="submit" className="app-primary-button rounded-lg px-4 py-2">{c.save}</button></div></form></Modal>
  </div>;
}

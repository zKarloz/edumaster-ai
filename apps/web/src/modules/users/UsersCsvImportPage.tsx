/** Importación institucional mediante una página completa.
 * Previsualizar NO envía correos. La importación requiere confirmación explícita
 * y conserva los resultados parciales para evitar reintentos indiscriminados.
 */
import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, MailPlus, Upload } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import { sectionPaths } from '../../routes';
import type { Organization } from '../organizations/types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const control = 'app-input w-full rounded-xl border px-3 py-2.5 text-sm';
const primary = 'app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';
const secondary = 'app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50';

type ValidRow = { line: number; valid: true; email: string; full_name: string; role: string };
type InvalidRow = { line: number; valid: false; message: string };
type PreviewRow = ValidRow | InvalidRow;
type ImportResult = { email: string; status: 'invited' | 'error'; message?: string };
interface Props { token: string; organizations: Organization[]; organizationId?: string; globalAdmin: boolean }
const validRow = (row: PreviewRow): row is ValidRow => row.valid;

function responseError(json: unknown, status: number): string {
  if (json && typeof json === 'object' && 'detail' in json && typeof json.detail === 'string') return json.detail;
  return `No se completó la operación (HTTP ${status})`;
}

export function UsersCsvImportPage({ token, organizations, organizationId, globalAdmin }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const routeOrganization = new URLSearchParams(location.search).get('institucion') ?? '';
  const [selectedOrg, setSelectedOrg] = useState('');
  // Una institución en la URL es solo una preferencia: la lista autorizada
  // y FastAPI siguen determinando el alcance real de la operación.
  const activeOrg = organizationId || (organizations.some(org => org.id === selectedOrg) ? selectedOrg
    : organizations.some(org => org.id === routeOrganization) ? routeOrganization : organizations[0]?.id ?? '');
  const ready = Boolean(activeOrg && organizations.some(org => org.id === activeOrg));
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importStarted, setImportStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const validRows = preview.filter(validRow);
  const invalidCount = preview.length - validRows.length;

  async function api<T>(path: string, body: object): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(responseError(json, response.status));
    return json as T;
  }

  function resetValidation() {
    setPreview([]); setResults([]); setProgress(0); setConfirmed(false); setImportStarted(false); setError('');
  }

  async function selectCsv(file?: File) {
    resetValidation(); setCsvText('');
    if (!file) return;
    if (file.size > 96_000) { setError('Máximo 96 KB por archivo CSV. Divide los usuarios en archivos menores.'); return; }
    try { setCsvText(await file.text()); }
    catch { setError('No se pudo leer el archivo CSV.'); }
  }

  async function previewCsv() {
    if (!ready || busy || !csvText) return;
    resetValidation(); setBusy(true);
    try {
      const data = await api<{ rows: PreviewRow[] }>(`/api/v1/provisioning/organizations/${activeOrg}/preview`, { csv_text: csvText });
      setPreview(data.rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo validar el CSV'); }
    finally { setBusy(false); }
  }

  async function importCsv() {
    if (!ready || busy || importStarted || !confirmed || invalidCount > 0 || !validRows.length) return;
    setImportStarted(true); setBusy(true); setError(''); setResults([]); setProgress(0);
    const all: ImportResult[] = [];
    // No hay reintento automático de lotes con error de red: podrían haberse
    // procesado en Supabase Auth antes de que se perdiera la respuesta.
    for (let i = 0; i < validRows.length; i += 20) {
      const batch = validRows.slice(i, i + 20).map(({ email, full_name, role }) => ({ email, full_name, role }));
      try {
        const data = await api<{ items: ImportResult[] }>(`/api/v1/provisioning/organizations/${activeOrg}/import`, {
          rows: batch, confirmed: true,
        });
        all.push(...data.items); setResults([...all]); setProgress(Math.min(validRows.length, i + batch.length));
      } catch (cause) {
        setError(`${cause instanceof Error ? cause.message : 'Fallo de red'}. Revisa las cuentas registradas antes de volver a intentar la importación.`);
        break;
      }
    }
    if (all.length) notify(`Invitaciones: ${all.filter(item => item.status === 'invited').length} enviadas, ${all.filter(item => item.status === 'error').length} con error.`, 'info');
    setBusy(false);
  }

  const previewColumns: Column<PreviewRow>[] = [
    { header: 'Fila', key: 'line' },
    { header: 'Correo', key: 'valid', render: row => row.valid ? row.email : '—' },
    { header: 'Nombre / Problema', key: 'line', render: row => row.valid ? row.full_name : <span className="text-rose-600 dark:text-rose-300">{row.message}</span> },
    { header: 'Rol', key: 'valid', render: row => row.valid ? row.role : 'Error' },
  ];
  const resultColumns: Column<ImportResult>[] = [
    { header: 'Correo', key: 'email' },
    { header: 'Estado', key: 'status', render: row => row.status === 'invited' ? 'Invitado' : 'Error' },
    { header: 'Observación', key: 'message', render: row => row.message || 'Correo de invitación solicitado' },
  ];

  return <section className="w-full space-y-5">
    {/* El título ya aparece en el topbar compartido. Conservamos solo la
        navegación de regreso, alineada con las demás páginas de EduMaster. */}
    <div className="flex justify-start">
      <button type="button" className={secondary} disabled={busy} onClick={() => navigate(sectionPaths.users)}><ArrowLeft size={16}/> Volver a Usuarios</button>
    </div>
    <div className="app-info rounded-2xl border p-4 text-sm">
      <p><strong>Formato:</strong> <code>email,full_name,role</code>. Hasta 300 filas y 96 KB; importación en lotes de 20.</p>
      <p className="mt-1">Validar solo comprueba los registros; no envía correos. Para importaciones masivas, configura SMTP y verifica sus límites. No importes datos DEMO en producción.</p>
    </div>
    <div className="app-panel grid gap-4 rounded-2xl border p-5 md:grid-cols-2">
      {globalAdmin && <div className="space-y-1.5"><label className="text-sm font-medium">Institución</label>
        <OptionSelect ariaLabel="Institución de CSV" value={activeOrg} options={organizations.map(org => ({ value: org.id, label: org.name }))}
          disabled={busy || importStarted} onChange={value => { setSelectedOrg(value); setCsvText(''); resetValidation(); }}/></div>}
      <label className="block space-y-1.5 text-sm font-medium">Archivo CSV (UTF-8)
        <input type="file" accept=".csv,text/csv" aria-label="Seleccionar archivo CSV" className={`${control} file:mr-3`}
          disabled={busy || importStarted} onChange={event => void selectCsv(event.target.files?.[0])}/></label>
      <div className="md:col-span-2 flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={!ready || !csvText || busy || importStarted}
          onClick={() => void previewCsv()}><Upload size={17}/> Validar sin enviar</button>
      </div>
    </div>
    {busy && <Spinner label={importStarted ? `Procesadas ${progress}/${validRows.length} filas...` : 'Validando registros CSV...'}/>}
    {preview.length > 0 && <div className="space-y-4">
      <p className="text-sm">Filas válidas: <strong>{validRows.length}</strong> de {preview.length}. Errores: <strong>{invalidCount}</strong>.</p>
      <DataTable label="Vista previa del CSV" rows={preview} columns={previewColumns}/>
      {invalidCount > 0 && <p role="alert" className="app-warning flex items-center gap-2 rounded-xl border p-3 text-sm"><AlertTriangle size={17}/> Corrige los errores antes de enviar invitaciones.</p>}
      {!importStarted && invalidCount === 0 && <div className="app-panel flex flex-col gap-3 rounded-xl border p-4">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={confirmed}
          onChange={event => setConfirmed(event.target.checked)}/>
          <span>Confirmo que estos correos pertenecen a personas autorizadas y deseo enviar las invitaciones.</span></label>
        <div><button type="button" className={primary} disabled={!confirmed || busy} onClick={() => void importCsv()}>
          <MailPlus size={17}/> Enviar {validRows.length} invitaciones</button></div>
      </div>}
    </div>}
    {importStarted && <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm"><CheckCircle2 size={17}/> Procesadas {progress} de {validRows.length} filas.</p>
      <DataTable label="Resultados de la importación" rows={results} columns={resultColumns}/>
    </div>}
    {error && <p role="alert" className="app-warning rounded-xl border p-4 text-sm">{error}</p>}
  </section>;
}

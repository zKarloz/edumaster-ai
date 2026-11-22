// Shell de Sprint 1: navegación, estado API, tema, componentes y Auth opcional.
// Los ejemplos académicos están rotulados DEMO; nunca simulan datos reales.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, ArrowRight, BookOpen, Building2, CheckCircle2, ChevronDown, Database,
  GraduationCap, LayoutDashboard, LockKeyhole, Menu, RefreshCw, Users, ClipboardList,
  Server, ShieldCheck, XCircle, Settings, PanelLeftClose, PanelLeftOpen, UserRound, X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router';
import { activityDetail, enrollmentHistoryPath, sectionForPath, sectionPaths, type Section } from './routes';
import { DataTable, type Column } from './components/shared/DataTable';
import { Modal } from './components/shared/Modal';
import { Spinner } from './components/shared/Spinner';
import { useToast } from './components/shared/Toast';
import { supabase } from './lib/supabase';
import { useSettings } from './providers/SettingsProvider';
import { SettingsPage } from './modules/settings/SettingsPage';
import { LoginScreen } from './LoginScreen';
import { OrganizationsPage } from './modules/organizations/OrganizationsPage';
import { AcademicPage } from './modules/academic/AcademicPage';
import { AcademicActivityPage } from './modules/academic/AcademicActivityPage';
import { UsersPage } from './modules/users/UsersPage';
import { InstitutionalUsersPage } from './modules/users/InstitutionalUsersPage';
import { AccountMenu } from './components/shared/AccountMenu';
import { ProfilePage } from './modules/profile/ProfilePage';
import { useAvatar } from './modules/profile/useAvatar';
import { UserAvatar } from './components/shared/UserAvatar';
import type { ProfileIdentity } from './modules/profile/types';
import type { Organization, OrganizationInput } from './modules/organizations/types';
import { countryName } from './modules/organizations/types';

type Connection = 'checking' | 'online' | 'offline';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const columns: Column<Organization>[] = [
  { header: 'Código', key: 'code' }, { header: 'Institución', key: 'name' },
  { header: 'País', key: 'country_code', render: item => countryName(item.country_code) },
  { header: 'Ciudad', key: 'city' },
];
const nav = [
  { id: 'dashboard' as const, title: 'Resumen', icon: LayoutDashboard },
  { id: 'organizations' as const, title: 'Instituciones', icon: Building2 },
  { id: 'users' as const, title: 'Usuarios', icon: Users },
  { id: 'courses' as const, title: 'Cursos', icon: BookOpen },
  { id: 'students' as const, title: 'Estudiantes', icon: GraduationCap },
  { id: 'enrollments' as const, title: 'Matrículas', icon: CheckCircle2 },
  { id: 'activity' as const, title: 'Actividad académica', icon: ClipboardList },
  { id: 'security' as const, title: 'Seguridad', icon: ShieldCheck },
  { id: 'settings' as const, title: 'Configuración', icon: Settings },
  { id: 'profile' as const, title: 'Perfil', icon: UserRound },
];

export default function App() {
  const { theme, setTheme, selectPreferenceScope } = useSettings();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem('edumaster_sidebar_collapsed') === 'true'; }
    catch { return false; }
  });
  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionForPath(location.pathname) ?? 'dashboard';
  const detailRoute = activityDetail(location.pathname);
  const [apiStatus, setApiStatus] = useState<Connection>('checking');
  const [session, setSession] = useState<Session | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgError, setOrgError] = useState('');
  const [orgRefreshKey, setOrgRefreshKey] = useState(0);
  const [identity, setIdentity] = useState<{ id: string; value: ProfileIdentity } | null>(null);
  const [globalRoles, setGlobalRoles] = useState<string[]>([]);
  const [memberships, setMemberships] = useState<Array<{ organization_id: string; roles: string[] }>>([]);
  const [academicOrgId, setAcademicOrgId] = useState('');
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authInitialized, setAuthInitialized] = useState(!supabase);
  const [accountStatus, setAccountStatus] = useState<'checking'|'ready'|'forbidden'|'unauthorized'|'error'>('checking');
  const [accountMessage, setAccountMessage] = useState('');
  // Identidad que superó la autorización. No depende de cada renovación del JWT.
  const [authorizedUserId, setAuthorizedUserId] = useState<string | null>(null);
  const { notify } = useToast();

  // Las opciones de interfaz se guardan para el usuario conectado en este navegador.
  useEffect(() => selectPreferenceScope(session?.user.id ?? null), [session?.user.id, selectPreferenceScope]);
  useEffect(() => {
    try { window.localStorage.setItem('edumaster_sidebar_collapsed', String(sidebarCollapsed)); }
    catch { /* Almacenamiento no disponible. */ }
  }, [sidebarCollapsed]);
  useEffect(() => {
    if (!mobileMenu) return;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenu(false); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenu]);

  const checkApi = useCallback(async () => {
    setApiStatus('checking');
    try {
      const response = await fetch(`${API}/health`, { signal: AbortSignal.timeout(8000) });
      setApiStatus(response.ok ? 'online' : 'offline');
      notify(response.ok ? 'Backend FastAPI disponible.' : 'El backend respondió con un error.', response.ok ? 'success' : 'info');
    } catch {
      setApiStatus('offline'); notify('No se puede conectar con FastAPI. Revisa que el servidor esté iniciado.');
    }
  }, [notify]);

  useEffect(() => {
    // Al iniciar la pantalla, el estado del backend se comprueba una sola vez.
    void (async () => {
      try {
        const response = await fetch(`${API}/health`, { signal: AbortSignal.timeout(8000) });
        setApiStatus(response.ok ? 'online' : 'offline');
      } catch { setApiStatus('offline'); }
    })();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(previous =>
        previous?.user.id === data.session?.user.id && previous?.access_token === data.session?.access_token
          ? previous : data.session);
    }).catch(() => {
      if (active) setAuthError('No se pudo recuperar la sesión. Revisa la conexión con Supabase.');
    }).finally(() => { if (active) setAuthInitialized(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, value) => {
      if (active) {
        // Supabase también emite SIGNED_IN al recuperar el foco de una pestaña.
        // Ignoramos sesiones idénticas para no reiniciar el proceso de autorización.
        setSession(previous => previous?.user.id === value?.user.id && previous?.access_token === value?.access_token
          ? previous : value);
        setAuthInitialized(true);
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // Validamos al iniciar sesión y cuando cambia el token, pero sin bloquear la vista
  // durante una renovación silenciosa para la MISMA identidad ya autorizada.
  // El backend sigue verificando el JWT y los permisos en cada petición protegida.
  const sessionUserId = session?.user.id ?? null;
  const accessToken = session?.access_token ?? null;
  useEffect(() => {
    if (!sessionUserId || !accessToken) {
      setAuthorizedUserId(null);
      setAccountStatus('checking');
      setAccountMessage('');
      setGlobalRoles([]);
      setIdentity(null);
      setMemberships([]);
      return;
    }

    // Si el usuario cambió o nunca pasó /me, se muestra la validación inicial.
    // Si solo cambió el JWT de un usuario aprobado, conservamos la UI mientras
    // el backend vuelve a verificar la autorización en segundo plano.
    if (authorizedUserId !== sessionUserId) {
      setAuthorizedUserId(null);
      setAccountStatus('checking');
      setAccountMessage('');
    }

    const controller = new AbortController();
    void fetch(`${API}/api/v1/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    }).then(response => {
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        setGlobalRoles([]);
        setAuthorizedUserId(null);
        setAccountStatus('unauthorized');
        return;
      }
      if (response.status === 403) {
        setGlobalRoles([]);
        setAuthorizedUserId(null);
        setAccountStatus('forbidden');
        return;
      }
      if (!response.ok) throw new Error(`La API respondió ${response.status}`);
      return response.json() as Promise<{ user: ProfileIdentity; global_roles: string[]; memberships: Array<{ organization_id: string; roles: string[] }> }>;
    }).then(profile => {
      if (!profile || controller.signal.aborted) return;
      setIdentity({ id: sessionUserId, value: profile.user });
      setGlobalRoles(profile.global_roles);
      setMemberships(profile.memberships ?? []);
      setAuthorizedUserId(sessionUserId);
      setAccountMessage('');
      setAccountStatus('ready');
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setGlobalRoles([]);
      setAuthorizedUserId(null);
      setAccountMessage(error instanceof Error ? error.message : 'No se pudo verificar el acceso.');
      setAccountStatus('error');
    });
    return () => controller.abort();
    // Deliberadamente no dependemos de authorizedUserId: solo revalidamos si
    // cambia la identidad o el JWT, nunca por un cambio de estado de la UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId, accessToken]);

  const accessGranted = Boolean(sessionUserId && authorizedUserId === sessionUserId && accountStatus === 'ready');
  // La foto se carga durante la validación de acceso, no después del dashboard.
  const avatar = useAvatar(sessionUserId);

  useEffect(() => {
    if (!accessGranted || !accessToken) {
      setOrgs([]);
      setOrgError('');
      return;
    }
    const controller = new AbortController();
    setLoadingOrgs(true);
    setOrgError('');
    void fetch(`${API}/api/v1/organizations`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error(`La API devolvió ${response.status}`);
      const payload: { items: Organization[] } = await response.json();
      if (!controller.signal.aborted) setOrgs(payload.items);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setOrgError(error instanceof Error ? error.message : 'Error al cargar instituciones');
    }).finally(() => { if (!controller.signal.aborted) setLoadingOrgs(false); });
    return () => controller.abort();
    // Se evita recargar las instituciones por cada refresh de token.
    // Los endpoints protegidos verifican el token vigente en el backend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId, accessGranted, orgRefreshKey]);


  // Solo el superadministrador puede administrar instituciones. La API vuelve
  // a validar el JWT y el rol en cada escritura, incluso si alteran esta UI.
  async function saveOrganization(input: OrganizationInput, id?: string): Promise<void> {
    if (!accessToken) throw new Error('La sesión no está disponible. Inicia sesión nuevamente.');
    // Los fallos de red/CORS no generan un Response. Mostrar una pista útil
    // sin exponer el JWT ni datos internos de la conexión en pantalla.
    let response: Response;
    try {
      response = await fetch(`${API}/api/v1/organizations${id ? `/${id}` : ''}`, {
        method: id ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { ...input, code: undefined } : input),
      });
    } catch {
      throw new Error('No se pudo conectar con FastAPI. Comprueba que esté activo en el puerto 8000, ALLOWED_ORIGINS y los errores de la terminal.');
    }
    if (!response.ok) {
      const payload: { detail?: string | Array<{ msg?: string }> } = await response.json().catch(() => ({}));
      const detail = typeof payload.detail === 'string' ? payload.detail
        : Array.isArray(payload.detail) ? payload.detail.map(item => item.msg).join('; ')
        : 'No se pudo guardar la institución.';
      throw new Error(response.status === 403 ? 'No tienes permisos para registrar instituciones.'
        : response.status === 401 ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
        : `${detail} (HTTP ${response.status})`);
    }
    notify(id ? 'Institución actualizada correctamente.' : 'Institución registrada correctamente.', 'success');
    setOrgRefreshKey(key => key + 1);
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError('');
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) { setAuthError(`No se pudo iniciar sesión: ${result.error.message}`); return; }
      setPassword('');
      notify('Identidad verificada. Comprobando autorización de EduMaster.ai...', 'success');
    } catch { setAuthError('No se pudo conectar con Supabase Auth.'); }
    finally { setAuthBusy(false); }
  }

  // TypeScript no conserva el estrechamiento de `supabase` dentro de callbacks JSX.
  // Esta función comprueba el cliente en su propio ámbito antes de cerrar sesión.
  async function signOut() {
    const client = supabase;
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) { notify(`No se pudo cerrar sesión: ${error.message}`); return; }
    setSession(null); setIdentity(null); navigate('/iniciar-sesion', { replace: true }); setPassword(''); setAuthorizedUserId(null); setGlobalRoles([]); setMemberships([]); setAccountStatus('checking');
    notify('Sesión cerrada correctamente.', 'success');
  }

  const institutionalAdminOrganizations = useMemo(() => orgs.filter(org =>
    memberships.some(item => item.organization_id === org.id && item.roles.includes('institution_admin'))),
    [orgs, memberships]);
  const canManageUserAdministration = globalRoles.includes('superadmin') || institutionalAdminOrganizations.length > 0;
  const canViewAcademicActivity = memberships.some(m => m.roles.some(role => ['institution_admin', 'coordinator', 'instructor'].includes(role)));
  const canManageAcademicOrganization = useCallback((orgId: string) => memberships.some(item => item.organization_id === orgId && item.roles.some(role => ['institution_admin', 'coordinator'].includes(role))), [memberships]);
  const title = nav.find(x => x.id === section)?.title ?? 'Resumen';
  const signedIn = Boolean(session);
  const isDemo = false;
  const rows = orgs;
  const navTo = (next: Section) => { navigate(sectionPaths[next]); setMobileMenu(false); };
  const academicRole = (orgId: string): 'manager'|'instructor'|'student' => {
    const roles = memberships.find(item => item.organization_id === orgId)?.roles ?? [];
    return roles.some(role => role === 'institution_admin' || role === 'coordinator') ? 'manager'
      : roles.includes('instructor') ? 'instructor' : 'student';
  };
  // La URL no concede privilegios: la UI oculta módulos restringidos y FastAPI
  // vuelve a comprobar el JWT, el rol y la institución en cada petición.
  useEffect(() => {
    if (!accessGranted) return;
    if (!sectionForPath(location.pathname)
      || (section === 'users' && !canManageUserAdministration)
      || (section === 'activity' && !canViewAcademicActivity)) {
      navigate(sectionPaths.dashboard, { replace: true });
    }
  }, [location.pathname, section, accessGranted, navigate, canManageUserAdministration, canViewAcademicActivity]);
  useEffect(() => {
    if (!detailRoute || !accessGranted) return;
    if (orgs.some(org => org.id === detailRoute.organizationId) && academicOrgId !== detailRoute.organizationId)
      setAcademicOrgId(detailRoute.organizationId);
  }, [detailRoute?.organizationId, accessGranted, orgs, academicOrgId]);
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'black' : 'light');

  if (!supabase) return <div className="app-shell flex min-h-screen items-center justify-center p-5 dark:bg-[#06152B]">
    <div className="app-panel max-w-md rounded-xl border border-amber-400/40 bg-white p-6 text-slate-800 dark:bg-[#0A1F3D] dark:text-slate-100">
      <h1 className="text-xl font-bold">Supabase no está configurado</h1>
      <p className="mt-2 text-sm">Revisa VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en apps/web/.env y reinicia Vite.</p>
    </div>
  </div>;
  if (!authInitialized) return <div className="app-shell flex min-h-screen items-center justify-center dark:bg-[#06152B] dark:text-white"><Spinner label="Recuperando sesión..."/></div>;
  if (!session) return <LoginScreen email={email} password={password} busy={authBusy} error={authError} theme={theme}
    onEmailChange={setEmail} onPasswordChange={setPassword} onThemeChange={cycleTheme} onSubmit={signIn}/>;
  if (!accessGranted) return <div className="app-shell flex min-h-screen items-center justify-center bg-[#F5F7FB] p-5 text-slate-900 dark:bg-[#06152B] dark:text-slate-100">
    <div className="app-panel w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-xl dark:border-[#23456A] dark:bg-[#0A1F3D]">
      <div className="mb-4 flex justify-center"><UserAvatar userId={session.user.id}
        name={identity?.id === session.user.id ? identity.value.name : String(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario')}
        photo={avatar.photo} loading={avatar.loading} large/></div>
      <LockKeyhole size={23} className="app-accent mx-auto text-[#087FE5]"/>
      <h1 className="mt-4 text-2xl font-bold">{accountStatus === 'checking' ? 'Validando acceso' : accountStatus === 'forbidden' ? 'Cuenta pendiente de habilitación' : accountStatus === 'unauthorized' ? 'El backend no aceptó tu sesión' : 'No se pudo verificar el acceso'}</h1>
      <p className="app-muted mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {accountStatus === 'checking' ? 'Comprobando que tu cuenta tenga roles autorizados en EduMaster.ai...'
          : accountStatus === 'forbidden' ? 'La identidad de Supabase Auth funciona, pero falta registrar o activar tus roles y membresías en el esquema app.'
          : accountStatus === 'unauthorized' ? 'FastAPI rechazó el JWT (401). Verifica la clave de firma activa ES256/RS256 en Supabase. Asignar roles SQL no soluciona este error.'
          : `${accountMessage}. Comprueba el backend y DATABASE_URL.`}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => window.location.reload()} className="app-primary-button rounded-lg bg-[#087FE5] px-4 py-2.5 text-sm font-semibold text-white">Reintentar</button>
        <button type="button" onClick={() => void signOut()} className="app-secondary-button rounded-lg border border-slate-300 px-4 py-2.5 text-sm">Cerrar sesión</button>
      </div>
    </div>
  </div>;

  const accountIdentity = identity && identity.id === session.user.id ? identity.value : { name: session.user.email?.split('@')[0] || 'Usuario', email: session.user.email || '' };

  return <div className="app-shell min-h-screen bg-[#F5F7FB] text-slate-900 transition-colors dark:bg-[#06152B] dark:text-slate-100">
    <div className="flex min-h-screen">
      {/* En móvil, el fondo clicable cierra el menú sin tocar sus contenidos. */}
      <button type="button" tabIndex={mobileMenu ? 0 : -1} aria-label="Cerrar navegación" aria-hidden={!mobileMenu}
        onClick={() => setMobileMenu(false)}
        className={`fixed inset-0 z-30 bg-black/60 transition-opacity duration-300 md:hidden ${mobileMenu ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}/>
      <aside id="edumaster-sidebar" aria-label="Menú principal" data-open={mobileMenu ? 'true' : 'false'}
        className={`app-sidebar app-mobile-drawer fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-xl md:sticky md:top-0 md:z-30 md:h-dvh md:shadow-none dark:border-[#163B63] dark:bg-[#071C37] ${sidebarCollapsed ? 'md:w-[76px]' : 'md:w-64'}`}>
        <div className="mb-9 flex min-h-12 items-center gap-3">
          <span className="app-brand-symbol shrink-0 rounded-xl bg-[#087FE5] p-2.5 text-white"><GraduationCap size={24}/></span>
          <div className={`min-w-0 flex-1 overflow-hidden ${sidebarCollapsed ? 'md:hidden' : ''}`}>
            <p className="whitespace-nowrap text-lg font-bold tracking-tight">EduMaster<span className="app-brand-accent text-[#20C8F5]">.ai</span></p>
            <p className="whitespace-nowrap app-meta-text text-[10px] uppercase tracking-[.2em] text-slate-500 dark:text-slate-400">Enterprise Platform</p>
          </div>
          <button type="button" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú" className="app-mobile-close ml-auto rounded-lg p-2 hover:bg-slate-100 md:hidden dark:hover:bg-[#163B63]"><X size={20}/></button>
        </div>
        <span className={`mb-3 px-3 app-meta-text text-xs font-semibold uppercase tracking-widest text-slate-400 ${sidebarCollapsed ? 'md:sr-only' : ''}`}>Plataforma</span>
        <nav aria-label="Navegación principal" className="grid gap-1">
          {nav.filter(link => (link.id !== 'users' || canManageUserAdministration) && (link.id !== 'activity' || canViewAcademicActivity)).map(link => {
            const Icon = link.icon;
            const active = section === link.id;
            return <button key={link.id} onClick={() => navTo(link.id)} type="button" title={sidebarCollapsed ? link.title : undefined}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors ${active ? 'app-nav-active bg-[#087FE5]/10 text-[#087FE5] dark:bg-[#103963] dark:text-[#20C8F5]' : 'app-nav-inactive text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#163B63]'}`}>
              <Icon size={19} className="shrink-0"/>
              <span className={`whitespace-nowrap ${sidebarCollapsed ? 'md:hidden' : ''}`}>{link.title}</span>
            </button>;
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="app-header sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 backdrop-blur md:px-8 dark:border-[#163B63] dark:bg-[#081B35]/95">
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-lg p-2 md:hidden" aria-expanded={mobileMenu} aria-controls="edumaster-sidebar" aria-label="Abrir navegación" onClick={() => setMobileMenu(true)}><Menu size={22}/></button>
            <button type="button" className="app-secondary-button hidden rounded-lg p-2 md:inline-flex" aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'} title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'} onClick={() => setSidebarCollapsed(current => !current)}>{sidebarCollapsed ? <PanelLeftOpen size={21}/> : <PanelLeftClose size={21}/>}</button>
            <div><span className="app-meta-text text-xs text-slate-400">EduMaster.ai / Administración</span><h1 className="text-xl font-bold">{title}</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden items-center gap-2 rounded-full px-3 py-2 text-xs sm:inline-flex ${apiStatus === 'online' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'app-status-warning bg-amber-500/10 text-amber-700'}`}>
              <span className={`size-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`}/>{apiStatus === 'checking' ? 'Comprobando...' : apiStatus === 'online' ? 'API conectada' : 'API sin conexión'}
            </span>
            <AccountMenu key={session.user.id} identity={accountIdentity} userId={session.user.id} photo={avatar.photo} photoLoading={avatar.loading}
              onProfile={() => navTo('profile')} onSignOut={signOut}/>
          </div>
        </header>
        <main key={section} className="module-enter mx-auto w-full app-content-container space-y-6 py-6">
          <section className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-2xl font-bold">{section === 'dashboard' ? 'Centro de administración' : `${title} · EduMaster.ai`}</h2>
              <p className="mt-1 text-sm app-muted text-slate-500 dark:text-slate-300">{signedIn ? `Sesión: ${session?.user.email ?? 'usuario'} · Datos limitados a tus instituciones` : 'Vista DEMO: sin datos institucionales reales'}</p>
            </div>
            <button onClick={() => void checkApi()} type="button" className="app-secondary-button flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:border-[#23456A] dark:bg-[#0A1F3D] dark:hover:bg-[#173658]"><RefreshCw size={16}/> Probar API</button>
          </section>
          {section === 'dashboard' && <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Arquitectura', value: 'Multi-tenant', icon: Building2, help: 'Arquitectura multiinstitución' },
                { label: 'Base de datos', value: 'PostgreSQL', icon: Database, help: 'Supabase · esquema app' },
                { label: 'Backend', value: 'FastAPI', icon: Server, help: 'Render / entorno local' },
                { label: 'Modo de datos', value: isDemo ? 'DEMO' : 'Conectado', icon: Activity, help: isDemo ? 'No hay KPIs oficiales' : 'Sesión autenticada' },
              ].map(card => <div key={card.label} className="app-panel rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#23456A] dark:bg-[#0A1F3D]">
                <div className="flex items-center justify-between text-sm app-muted text-slate-500 dark:text-slate-300"><span>{card.label}</span><card.icon size={20} className="app-accent text-[#087FE5] dark:text-[#20C8F5]"/></div>
                <p className="mt-4 text-2xl font-bold">{card.value}</p><p className="mt-2 app-meta-text text-xs text-slate-400">{card.help}</p>
              </div>)}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D]">
                <h3 className="font-semibold">Fundaciones del sistema</h3>
                <div className="mt-5 space-y-4">{[
                  ['React, TypeScript y Tailwind', true],['Tema claro/oscuro', true],['FastAPI · /health', true],['Supabase Auth y PostgreSQL', true],['RBAC/ABAC por institución', false]
                ].map(([label, ready]) => <div key={String(label)} className="flex items-center gap-3 text-sm">{ready ? <CheckCircle2 size={18} className="text-emerald-500"/> : <XCircle size={18} className="text-slate-400"/>}<span>{label}</span></div>)}</div>
              </div>
              <div className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D]">
                <h3 className="font-semibold">Próximos pasos</h3>
                <p className="mt-3 text-sm leading-7 app-muted text-slate-500 dark:text-slate-300">Crea cursos en una institución, incorpora estudiantes con cuenta de Supabase Auth confirmada y registra matrículas. Registra actividad académica real (notas, asistencia, participación y progreso) en las matrículas. El siguiente incremento será el modelo neuronal experimental con revisión docente.</p>
                <button onClick={() => navTo('security')} className="app-accent mt-5 flex items-center gap-2 text-sm font-semibold text-[#087FE5] dark:text-[#20C8F5]">Revisar seguridad <ArrowRight size={15}/></button>
              </div>
            </div>
          </>}
          {section === 'dashboard' && <>
            {loadingOrgs && <Spinner label="Consultando instituciones autorizadas..."/>}
            {orgError && <div role="alert" className="app-warning rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{orgError}. Comprueba la API y la migración de ubicaciones.</div>}
            <DataTable<Organization> rows={rows} columns={columns} label={isDemo ? 'Instituciones (datos DEMO)' : 'Instituciones autorizadas'} />
          </>}
          {section === 'organizations' && <OrganizationsPage
            organizations={orgs} loading={loadingOrgs} error={orgError}
            canManage={globalRoles.includes('superadmin')}
            onRefresh={() => setOrgRefreshKey(key => key + 1)}
            onSave={saveOrganization}
          />}
          {section === 'users' && accessToken && (globalRoles.includes('superadmin')
            ? <UsersPage token={accessToken} organizations={orgs} canManage/>
            : <InstitutionalUsersPage token={accessToken} organizations={institutionalAdminOrganizations}/>)}
          {section === 'settings' && <SettingsPage/>}
          {section === 'profile' && accessToken && <ProfilePage key={session.user.id} identity={accountIdentity} token={accessToken}
            userId={session.user.id} photo={avatar.photo} photoLoading={avatar.loading} onIdentity={value => setIdentity({ id: session.user.id, value })}
            onSavePhoto={avatar.save} onRemovePhoto={avatar.remove}/>}
          {(section === 'courses' || section === 'students' || section === 'enrollments') && accessToken && <AcademicPage
            mode={section} organizations={orgs} organizationId={academicOrgId}
            onOrganizationChange={setAcademicOrgId} token={accessToken}
            courseRole={academicRole(academicOrgId)}
            canManageOrganization={canManageAcademicOrganization}/>}
          {section === 'activity' && accessToken && <AcademicActivityPage
            organizations={orgs} organizationId={academicOrgId}
            onOrganizationChange={setAcademicOrgId} token={accessToken}
            selectedEnrollmentId={detailRoute?.enrollmentId ?? ''}
            selectedOfferingId={detailRoute?.offeringId ?? ''}
            onSelectEnrollment={(offeringId, enrollmentId) => navigate(enrollmentHistoryPath(academicOrgId, offeringId, enrollmentId))}
            onBackToOverview={() => navTo('activity')}/>}
          {section === 'security' && <div className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D]">
            <LockKeyhole size={24} className="app-accent text-[#20C8F5]"/><h3 className="mt-3 text-lg font-semibold">Aislamiento por institución</h3>
            <p className="mt-2 text-sm leading-7 app-muted text-slate-500 dark:text-slate-300">Auth y RBAC se validarán en FastAPI. Las FKs compuestas impiden referencias entre instituciones; el esquema privado no se publica por Supabase Data API. Las políticas ABAC detalladas quedan pendientes de implementar y probar.</p>
            <button type="button" onClick={() => setShowPermissions(true)} className="app-secondary-button mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600">Ver controles planificados <ChevronDown size={16}/></button>
          </div>}
          <footer className="app-page-footer flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-[#23456A] dark:text-slate-400"><span>EduMaster.ai · Aprende · Practica · Destaca</span><span>Entorno de desarrollo · 2026</span></footer>
        </main>
      </div>
    </div>
    <Modal open={showPermissions} title="Controles por completar" onClose={() => setShowPermissions(false)}>
      <ul className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-200">
        <li>• Verificar los permisos del usuario antes de cada acción protegida.</li>
        <li>• Autorizar recursos según institución, curso y propiedad del registro.</li>
        <li>• Probar accesos denegados entre instituciones A y B.</li>
        <li>• Auditar cambios críticos y operaciones sensibles.</li>
      </ul>
    </Modal>
  </div>;
}

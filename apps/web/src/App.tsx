import { isFavoriteRole, type FavoriteScope } from './modules/favorites/favoriteRules';
// Shell de Sprint 1: navegación, estado API, tema, componentes y Auth opcional.
// Los ejemplos académicos están rotulados DEMO; nunca simulan datos reales.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { BookOpen, Building2, CheckCircle2, ChevronDown,
  GraduationCap, LayoutDashboard, LockKeyhole, Menu, Users, ClipboardList, BrainCircuit,
  ShieldCheck, Settings, PanelLeftClose, PanelLeftOpen, Wallet, X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { activityDetail, courseWorkspaceDetail, lessonEditorDetail, newLessonDetail, taskReviewDetail, taskSubmissionsDetail, myTaskSubmissionsDetail, courseTaskDetail, enrollmentHistoryPath, legacyRedirect, sectionForPath, sectionPaths, isUsersCsvImportPath, type Section } from './routes';
import { Modal } from './components/shared/Modal';
import { Spinner } from './components/shared/Spinner';
import { useToast } from './components/shared/Toast';
import { supabase } from './lib/supabase';
import { chooseAcademicInstitution, maySelectAcademicInstitution } from './lib/institutionContext';
import { moduleAccess } from './lib/moduleAccess';
import { useSettings } from './providers/SettingsProvider';
import { SettingsPage } from './modules/settings/SettingsPage';
import { LoginScreen } from './LoginScreen';
import { LandingPage } from './modules/landing/LandingPage';
import { OrganizationsPage } from './modules/organizations/OrganizationsPage';
import { AcademicPage } from './modules/academic/AcademicPage';
import { CourseWorkspacePage } from './modules/academic/CourseWorkspacePage';
// Carga diferida: Tiptap no incrementa el bundle inicial de la plataforma.
const IncomeDemoPage = lazy(() => import('./modules/income/IncomeDemoPage').then(mod => ({default:mod.IncomeDemoPage})));
const NeuralNetworkPage = lazy(() => import('./modules/intelligence/NeuralNetworkPage').then(mod => ({default:mod.NeuralNetworkPage})));
const LessonEditorPage = lazy(() => import('./modules/academic/LessonEditorPage').then(mod => ({default:mod.LessonEditorPage})));
const LessonCreatePage = lazy(() => import('./modules/academic/LessonCreatePage').then(mod => ({default:mod.LessonCreatePage})));
const TaskSubmissionsPage = lazy(() => import('./modules/academic/TaskSubmissionsPage').then(mod => ({default:mod.TaskSubmissionsPage})));
const CourseTaskPage = lazy(() => import('./modules/academic/CourseTaskPage').then(mod => ({default:mod.CourseTaskPage})));
const TaskSubmissionReviewPage = lazy(() => import('./modules/academic/TaskSubmissionReviewPage').then(mod => ({default:mod.TaskSubmissionReviewPage})));
import { AcademicActivityPage } from './modules/academic/AcademicActivityPage';
import { UsersPage } from './modules/users/UsersPage';
import { UsersCsvImportPage } from './modules/users/UsersCsvImportPage';
import { InvitePasswordSetup } from './modules/users/InvitePasswordSetup';
import { InstitutionalUsersPage } from './modules/users/InstitutionalUsersPage';
import { NotificationInbox } from './components/shared/NotificationInbox';
import { AccountMenu } from './components/shared/AccountMenu';
import { ProfilePage } from './modules/profile/ProfilePage';
import { useAvatar } from './modules/profile/useAvatar';
import { UserAvatar } from './components/shared/UserAvatar';
import type { ProfileIdentity } from './modules/profile/types';
import type { Organization, OrganizationInput } from './modules/organizations/types';
import { DashboardPage } from './modules/dashboard/DashboardPage';

type Connection = 'checking' | 'online' | 'offline';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const nav = [
  { id: 'dashboard' as const, title: 'Resumen', icon: LayoutDashboard },
  { id: 'intelligence' as const, title: 'Inteligencia artificial', icon: BrainCircuit },
  { id: 'organizations' as const, title: 'Instituciones', icon: Building2 },
  { id: 'income' as const, title: 'Ingresos', icon: Wallet },
  { id: 'users' as const, title: 'Usuarios', icon: Users },
  { id: 'courses' as const, title: 'Cursos', icon: BookOpen },
  { id: 'students' as const, title: 'Estudiantes', icon: GraduationCap },
  { id: 'enrollments' as const, title: 'Matrículas', icon: CheckCircle2 },
  { id: 'activity' as const, title: 'Actividad académica', icon: ClipboardList },
  { id: 'security' as const, title: 'Seguridad', icon: ShieldCheck },
  { id: 'settings' as const, title: 'Configuración', icon: Settings },
 ];
/** Las categorías vacías no aparecen cuando el rol no tiene acceso a sus módulos. */
const navGroups = [
  { label: 'nav.platform', sections: ['dashboard'] },
  { label: 'nav.management', sections: ['organizations', 'users', 'income'] },
  { label: 'nav.academic', sections: ['courses', 'students', 'enrollments', 'activity'] },
  { label: 'nav.ai', sections: ['intelligence'] },
  { label: 'nav.system', sections: ['security', 'settings'] },
] as const;

export default function App() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, sidebarMode, setSidebarMode, selectPreferenceScope, syncProfileLocale } = useSettings();
  const [sidebarHover, setSidebarHover] = useState(false);
  const [sidebarKeyboardFocus, setSidebarKeyboardFocus] = useState(false);
  const [sidebarOptionsOpen, setSidebarOptionsOpen] = useState(false);
  const sidebarModeRoot = useRef<HTMLDivElement>(null);
  const sidebarModeTrigger = useRef<HTMLButtonElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionForPath(location.pathname) ?? 'dashboard';
  const usersCsvImportRoute = isUsersCsvImportPath(location.pathname);
  const detailRoute = activityDetail(location.pathname);
  const courseRoute = courseWorkspaceDetail(location.pathname);
  const lessonRoute = lessonEditorDetail(location.pathname);
  const newLessonRoute = newLessonDetail(location.pathname);
  const taskReviewRoute = taskReviewDetail(location.pathname);
  const taskSubmissionsRoute = taskSubmissionsDetail(location.pathname);
  const myTaskSubmissionsRoute = myTaskSubmissionsDetail(location.pathname);
  const courseTaskRoute = courseTaskDetail(location.pathname);
  const [apiStatus, setApiStatus] = useState<Connection>('checking');
  const [session, setSession] = useState<Session | null>(null);
  // Se detecta antes de que Supabase consuma el fragmento de Auth.
  const [inviteSetup, setInviteSetup] = useState(() => {
    try { return /(?:[?#&])type=invite(?:&|$)/.test(window.location.href) || sessionStorage.getItem('edumaster:invite-setup') === '1'; }
    catch { return /(?:[?#&])type=invite(?:&|$)/.test(window.location.href); }
  });
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgError, setOrgError] = useState('');
  const [orgRefreshKey, setOrgRefreshKey] = useState(0);
  const [identity, setIdentity] = useState<{ id: string; value: ProfileIdentity } | null>(null);
  const [globalRoles, setGlobalRoles] = useState<string[]>([]);
  const [memberships, setMemberships] = useState<Array<{ organization_id: string; roles: string[] }>>([]);
  const [academicOrgId, setAcademicOrgId] = useState('');
  const contextUserRef = useRef<string|null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const sidebarWide = sidebarMode === 'expanded' || (sidebarMode === 'dynamic' && (sidebarHover || sidebarKeyboardFocus || sidebarOptionsOpen)) || mobileMenu;
  const sidebarRail = sidebarMode !== 'expanded';
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
  // Migración de rutas v17. Se conservan rutas profundas de historiales.
  useEffect(() => {
    const destination = legacyRedirect(location.pathname);
    if (destination) navigate(`${destination}${location.search}${location.hash}`, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);
  // La opción seleccionada cierra el selector; el rail dinámico no se debe quedar
  // fijado por el foco de un botón pulsado con el ratón.
  useEffect(() => { setSidebarOptionsOpen(false); setSidebarKeyboardFocus(false); }, [sidebarMode]);
  useEffect(() => {
    if (!sidebarOptionsOpen) return;
    const outside = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node && !sidebarModeRoot.current?.contains(event.target)) setSidebarOptionsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setSidebarOptionsOpen(false);
      sidebarModeTrigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [sidebarOptionsOpen]);
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
  // Al cambiar de cuenta no debemos reutilizar el contexto de otra persona.
  useEffect(()=>{
    if(contextUserRef.current!==sessionUserId){
      contextUserRef.current=sessionUserId;
      setAcademicOrgId('');
    }
  },[sessionUserId]);
  const accessToken = session?.access_token ?? null;
  useEffect(() => {
    if (!accessToken || !sessionUserId || accountStatus !== 'ready') return;
    const controller = new AbortController();
    void fetch(`${API}/api/v1/me/details`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
    }).then(response => response.ok ? response.json() as Promise<{language_code: string | null}> : null)
      .then(details => { if (details && !controller.signal.aborted) syncProfileLocale(details.language_code); })
      .catch(() => { /* La preferencia local continúa disponible sin red. */ });
    return () => controller.abort();
    // El ID y el estado cambian al autenticar; las renovaciones de JWT no deben reiniciar la UI.
  }, [sessionUserId, accountStatus, accessToken, syncProfileLocale]);
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

  // Separa confirmar salida del cierre real: un borrador abierto puede
  // bloquear el cierre de sesión mediante su modal compartido.
  async function completeSignOut():Promise<boolean> {
    const client = supabase;
    if (!client) return false;
    const { error } = await client.auth.signOut();
    if (error) { notify(`No se pudo cerrar sesión: ${error.message}`); return false; }
    try { sessionStorage.removeItem('edumaster:invite-setup'); } catch { /* Sin persistencia. */ }
    setInviteSetup(false);
    setSession(null); setIdentity(null); navigate('/login', { replace: true }); setPassword(''); setAuthorizedUserId(null); setGlobalRoles([]); setMemberships([]); setAcademicOrgId(''); setAccountStatus('checking');
    notify('Sesión cerrada correctamente.', 'success');
    return true;
  }
  async function signOut() {
    // La lección puede impedir temporalmente esta acción hasta que el
    // usuario confirme si desea descartar su borrador sin guardar.
    if (!window.dispatchEvent(new Event('edumaster:before-signout', { cancelable: true }))) return;
    await completeSignOut();
  }

  const institutionalAdminOrganizations = useMemo(() => orgs.filter(org =>
    memberships.some(item => item.organization_id === org.id && item.roles.includes('institution_admin'))),
    [orgs, memberships]);
  // Solo administradores/coordinadores cambian el contexto desde Instituciones.
  // Docentes y estudiantes reciben automáticamente su organización autorizada.
  const canChooseInstitution = maySelectAcademicInstitution(globalRoles,memberships);
  const canOpenInstitutions = canChooseInstitution;
  const selectAcademicInstitution = useCallback((id:string) => {
    if(!canChooseInstitution || !orgs.some(org=>org.id===id))return;
    setAcademicOrgId(id);
    if(sessionUserId){
      try{localStorage.setItem(`edumaster:institution:${sessionUserId}`,id);}catch{/* Navegación disponible aunque el almacenamiento esté deshabilitado. */}
    }
  },[canChooseInstitution,orgs,sessionUserId]);
  useEffect(()=>{
    if(!accessGranted)return;
    const ids=orgs.map(org=>org.id);
    let saved:string|null=null;
    if(canChooseInstitution && sessionUserId){
      try{saved=localStorage.getItem(`edumaster:institution:${sessionUserId}`);}catch{/* Preferencia no disponible. */}
    }
    // Las rutas profundas ya autorizadas tienen prioridad sobre una preferencia
    // guardada; así evitamos bucles A↔B y respetamos enlaces directos.
    const routeOrgId=courseRoute?.organizationId??detailRoute?.organizationId??lessonRoute?.organizationId??newLessonRoute?.organizationId
      ??taskReviewRoute?.organizationId??taskSubmissionsRoute?.organizationId??myTaskSubmissionsRoute?.organizationId
      ??courseTaskRoute?.organizationId;
    const next=routeOrgId && ids.includes(routeOrgId) ? routeOrgId
      :chooseAcademicInstitution(ids,academicOrgId,saved,canChooseInstitution);
    if(next!==academicOrgId)setAcademicOrgId(next);
  },[accessGranted,orgs,sessionUserId,canChooseInstitution,academicOrgId,
    courseRoute?.organizationId,detailRoute?.organizationId,lessonRoute?.organizationId,newLessonRoute?.organizationId,
    taskReviewRoute?.organizationId,taskSubmissionsRoute?.organizationId,myTaskSubmissionsRoute?.organizationId,
    courseTaskRoute?.organizationId]);

  const canManageAcademicOrganization = useCallback((orgId: string) => memberships.some(item => item.organization_id === orgId && item.roles.some(role => ['institution_admin', 'coordinator'].includes(role))), [memberships]);
  // La cabecera global presenta el contexto de las dos páginas docentes.
  const academicLanguage = i18n.language.toLowerCase().startsWith('pt') ? 'pt' : i18n.language.toLowerCase().startsWith('en') ? 'en' : 'es';
  const reviewNames = {
    es: {list:'Revisar entregas', detail:'Revisar entrega', mine:'Mis entregas', taskDetail:'Tarea', newTask:'Nueva tarea', path:'Cursos / Actividades y tareas'},
    en: {list:'Review submissions', detail:'Review submission', mine:'My submissions', taskDetail:'Assignment', newTask:'New assignment', path:'Courses / Assignments'},
    pt: {list:'Revisar entregas', detail:'Revisar entrega', mine:'Minhas entregas', taskDetail:'Tarefa', newTask:'Nova tarefa', path:'Cursos / Tarefas'},
  }[academicLanguage];
  const title = usersCsvImportRoute ? 'Importar usuarios desde CSV' : taskReviewRoute ? reviewNames.detail : taskSubmissionsRoute ? reviewNames.list
    : courseTaskRoute ? (courseTaskRoute.taskId==='nueva' ? reviewNames.newTask : reviewNames.taskDetail)
    : newLessonRoute ? t('workspace.addLesson') : lessonRoute ? t('lessonEditor.pageTitle')
    : myTaskSubmissionsRoute ? reviewNames.taskDetail
    : t(`nav.${section === 'dashboard' ? 'dashboard' : section}`);
  const headerPath = usersCsvImportRoute ? 'Usuarios / Importación CSV' : newLessonRoute || lessonRoute ? reviewNames.path + ' / ' + t('workspace.content')
    : taskReviewRoute ? `${reviewNames.path} / ${reviewNames.list}`
    : taskSubmissionsRoute || myTaskSubmissionsRoute || courseTaskRoute ? reviewNames.path : null;
  // La categoría superior procede de la misma definición del menú: al cambiar
  // de módulo o idioma, la cabecera refleja su contexto sin texto fijo.
  const currentCategoryKey = section === 'profile'
    ? 'nav.account'
    : navGroups.find(group => group.sections.some(id => id === section))?.label ?? 'nav.platform';
  // Los permisos proceden de /me, no del catálogo de instituciones que carga después.
  const navigationAccess = moduleAccess(globalRoles, memberships, academicOrgId);
  // Las rutas profundas se evalúan contra su propia institución, no una preferencia anterior.
  const routeOrganizationId = courseRoute?.organizationId ?? detailRoute?.organizationId ?? lessonRoute?.organizationId ?? newLessonRoute?.organizationId
    ?? taskReviewRoute?.organizationId ?? taskSubmissionsRoute?.organizationId ?? myTaskSubmissionsRoute?.organizationId ?? courseTaskRoute?.organizationId;
  const routeAccess = routeOrganizationId ? moduleAccess(globalRoles, memberships, routeOrganizationId) : navigationAccess;
  const navTo = (next: Section) => {
    // useBlocker en LessonEditorPage protege todas las navegaciones SPA.
    if (!navigationAccess[next]) return;
    navigate(sectionPaths[next]); setMobileMenu(false);
  };
  const academicRole = (orgId: string): 'manager'|'instructor'|'student' => {
    const roles = memberships.find(item => item.organization_id === orgId)?.roles ?? [];
    return roles.some(role => role === 'institution_admin' || role === 'coordinator') ? 'manager'
      : roles.includes('instructor') ? 'instructor' : 'student';
  };
  // Una ruta de módulo válida no debe perderse al recargar mientras cambian
  // los estados asíncronos de identidad e instituciones. La autorización se
  // controla antes de montar cada módulo; FastAPI vuelve a validar cada petición.
  const sectionPermissionDenied = !routeAccess[section];
  useEffect(() => {
    if (!accessGranted || location.pathname === '/') return;
    // Solo las URLs realmente desconocidas regresan a Resumen.
    if (!sectionForPath(location.pathname) && !legacyRedirect(location.pathname)) {
      navigate(sectionPaths.dashboard, { replace: true });
    }
  }, [location.pathname, accessGranted, navigate]);
  useEffect(() => {
    if (!courseRoute || !accessGranted) return;
    if (orgs.some(org=>org.id===courseRoute.organizationId) && academicOrgId!==courseRoute.organizationId)
      setAcademicOrgId(courseRoute.organizationId);
  }, [courseRoute?.organizationId, accessGranted, orgs, academicOrgId]);
  useEffect(() => {
    if (!detailRoute || !accessGranted) return;
    if (orgs.some(org => org.id === detailRoute.organizationId) && academicOrgId !== detailRoute.organizationId)
      setAcademicOrgId(detailRoute.organizationId);
  }, [detailRoute?.organizationId, accessGranted, orgs, academicOrgId]);
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'black' : 'light');

  // La portada no requiere sesión; los enlaces de invitación conservan prioridad.
  if (location.pathname === '/' && !inviteSetup && !location.search.includes('code=') && !location.hash.includes('access_token=')) return <LandingPage authenticated={Boolean(session)}/>;
  if (!supabase) return <div className="app-shell flex min-h-screen items-center justify-center p-5 dark:bg-[#06152B]">
    <div className="app-panel max-w-md rounded-xl border border-amber-400/40 bg-white p-6 text-slate-800 dark:bg-[#0A1F3D] dark:text-slate-100">
      <h1 className="text-xl font-bold">{t('legacy.k0a5b6d202d')}</h1>
      <p className="mt-2 text-sm">{t('legacy.ka7e4783f59')}</p>
    </div>
  </div>;
  if (!authInitialized) return <div className="app-shell flex min-h-screen items-center justify-center dark:bg-[#06152B] dark:text-white"><Spinner label={t('login.restoring')}/></div>;
  if (!session) return <LoginScreen email={email} password={password} busy={authBusy} error={authError} theme={theme}
    onEmailChange={setEmail} onPasswordChange={setPassword} onThemeChange={cycleTheme} onSubmit={signIn}/>;
  if (inviteSetup && session) return <InvitePasswordSetup email={session.user.email || ''} onDone={() => {
    try { sessionStorage.removeItem('edumaster:invite-setup'); } catch { /* Sin persistencia. */ }
    setInviteSetup(false);
    if (location.pathname === '/') navigate(sectionPaths.dashboard, { replace: true });
  }}/>;
  if (!accessGranted) return <div className="app-shell flex min-h-screen items-center justify-center bg-[#F5F7FB] p-5 text-slate-900 dark:bg-[#06152B] dark:text-slate-100">
    <div className="app-panel w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-xl dark:border-[#23456A] dark:bg-[#0A1F3D]">
      <div className="mb-4 flex justify-center"><UserAvatar userId={session.user.id}
        name={identity?.id === session.user.id ? identity.value.name : String(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario')}
        photo={avatar.photo} loading={avatar.loading} large/></div>
      <LockKeyhole size={23} className="app-accent mx-auto text-[#087FE5]"/>
      <h1 className="mt-4 text-2xl font-bold">{accountStatus === 'checking' ? t('login.validating') : accountStatus === 'forbidden' ? t('login.denied') : accountStatus === 'unauthorized' ? t('login.unauthorized') : 'No se pudo verificar el acceso'}</h1>
      <p className="app-muted mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {accountStatus === 'checking' ? t('login.validatingMessage')
          : accountStatus === 'forbidden' ? t('login.deniedMessage')
          : accountStatus === 'unauthorized' ? 'FastAPI rechazó el JWT (401). Verifica la clave de firma activa ES256/RS256 en Supabase. Asignar roles SQL no soluciona este error.'
          : `${accountMessage}. Comprueba el backend y DATABASE_URL.`}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => window.location.reload()} className="app-primary-button rounded-lg bg-[#087FE5] px-4 py-2.5 text-sm font-semibold text-white">{t('login.retry')}</button>
        <button type="button" onClick={() => void signOut()} className="app-secondary-button rounded-lg border border-slate-300 px-4 py-2.5 text-sm">{t('login.signout')}</button>
      </div>
    </div>
  </div>;

  const accountIdentity = identity && identity.id === session.user.id ? identity.value : { name: session.user.email?.split('@')[0] || 'Usuario', email: session.user.email || '' };
  const favoriteScopes = (orgId:string):FavoriteScope[] => (memberships.find(m=>m.organization_id===orgId)?.roles??[]).filter(isFavoriteRole).map(role=>({userId:session.user.id,organizationId:orgId,role}));
  // Una cuenta puede tener varios roles; se muestran los del contexto institucional
  // seleccionado, o todos los de su primera institución cuando aún no se eligió.
  const contextRoles = memberships.find(m => m.organization_id === academicOrgId)?.roles ?? memberships[0]?.roles ?? [];
  const accountRoleKeys = globalRoles.includes('superadmin') ? ['superadmin'] : contextRoles;
  const accountRoleLabel = accountRoleKeys.length
    ? accountRoleKeys.map(role => {
      const roleKey = `account.role_${role}`;
      return t(roleKey, { defaultValue: role.replaceAll('_', ' ') });
    }).join(' · ')
    : t('account.role_user');

  // Los clics de ratón no deben retener la expansión, incluso si el botón
  // navegado permanece como document.activeElement. Tab conserva accesibilidad.
  const onSidebarPointerDown = (_event: ReactPointerEvent<HTMLElement>) => {
    setSidebarKeyboardFocus(false);
  };

  return <div className="app-shell min-h-screen bg-[#F5F7FB] text-slate-900 transition-colors dark:bg-[#06152B] dark:text-slate-100">
    <div className="flex min-h-screen">
      {/* En móvil, el fondo clicable cierra el menú sin tocar sus contenidos. */}
      <button type="button" tabIndex={mobileMenu ? 0 : -1} aria-label={t('labels.kdb3f8c9269')} aria-hidden={!mobileMenu}
        onClick={() => setMobileMenu(false)}
        className={`fixed inset-0 z-30 bg-black/60 transition-opacity duration-300 md:hidden ${mobileMenu ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}/>
      <aside id="edumaster-sidebar" aria-label={t('nav.platform')} data-open={mobileMenu ? 'true' : 'false'} data-wide={sidebarWide ? 'true' : 'false'}
        onMouseEnter={() => setSidebarHover(true)} onMouseLeave={() => setSidebarHover(false)}
        onPointerDownCapture={onSidebarPointerDown}
        onFocusCapture={event => {
          // :focus-visible distingue la navegación Tab de los clics que dejaban
          // el sidebar dinámico permanentemente expandido.
          if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) setSidebarKeyboardFocus(true);
        }}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setSidebarKeyboardFocus(false); }}
        className={`app-sidebar app-mobile-drawer fixed inset-y-0 left-0 z-40 h-dvh shrink-0 border-r border-slate-200 bg-white shadow-xl md:sticky md:top-0 md:z-30 md:shadow-none dark:border-[#163B63] dark:bg-[#071C37] ${sidebarRail ? 'md:w-[76px]' : 'md:w-64'} ${sidebarMode === 'dynamic' ? 'app-sidebar-dynamic' : ''}`}>
        {/* En dinámico la capa interna se extiende sobre el contenido sin desplazarlo. */}
        <div className={`app-sidebar-inner flex h-dvh w-64 flex-col border-r border-transparent bg-inherit p-3 md:h-dvh ${sidebarMode === 'dynamic' ? 'md:absolute md:left-0 md:top-0' : ''} ${!sidebarWide ? 'md:w-[76px]' : 'md:w-64'}`}>
          <div className="mb-5 flex min-h-12 shrink-0 items-center gap-3 px-1">
            <span className="app-brand-symbol shrink-0 rounded-xl bg-[#087FE5] p-2.5 text-white"><GraduationCap size={24}/></span>
            <div className={`min-w-0 flex-1 overflow-hidden ${!sidebarWide ? 'md:hidden' : ''}`}>
              <p className="whitespace-nowrap text-lg font-bold tracking-tight">EduMaster<span className="app-brand-accent text-[#20C8F5]">.ai</span></p>
              <p className="whitespace-nowrap app-meta-text text-[10px] uppercase tracking-[.2em] text-slate-500 dark:text-slate-400">Enterprise Platform</p>
            </div>
            <button type="button" onClick={() => setMobileMenu(false)} aria-label={t('nav.closeMenu')}
              className="app-mobile-close ml-auto rounded-lg p-2 hover:bg-slate-100 md:hidden dark:hover:bg-[#163B63]"><X size={20}/></button>
          </div>
          <nav aria-label={t('nav.platform')} className="app-sidebar-scroll min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto pb-3">
            {navGroups.map(group => {
              const visible = group.sections.map(id => nav.find(link => link.id === id)).filter((link): link is typeof nav[number] =>
                Boolean(link && navigationAccess[link.id]));
              if (!visible.length) return null;
              return <div key={group.label} className="space-y-1">
                <p aria-label={t(group.label)} className={`app-sidebar-group-heading h-5 overflow-hidden whitespace-nowrap px-3 pb-1 text-xs font-semibold uppercase tracking-widest app-meta-text text-slate-400 ${!sidebarWide ? 'md:flex md:min-h-4 md:items-center md:px-0' : ''}`}>
                  {/* El rótulo conserva una sola línea mientras cambia el ancho del sidebar. */}
                  <span className={`shrink-0 whitespace-nowrap ${sidebarWide ? '' : 'md:hidden'}`}>{t(group.label)}</span>
                  {/* En modo rail, el mismo separador horizontal que en el pie. */}
                  {!sidebarWide && <span aria-hidden="true" className="app-sidebar-category-dash hidden md:block"/>}
                </p>
                {visible.map(link => {
                  const Icon = link.icon;
                  const active = section === link.id;
                  return <button key={link.id} onClick={event => { if (event.detail > 0) event.currentTarget.blur(); navTo(link.id); }} type="button"
                    title={!sidebarWide ? t(`nav.${link.id}`) : undefined}
                    aria-label={t(`nav.${link.id}`)} aria-current={active ? 'page' : undefined}
                    className={`app-sidebar-nav-link flex w-full min-h-11 min-w-0 flex-nowrap items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors ${active ? 'app-nav-active bg-[#087FE5]/10 text-[#087FE5] dark:bg-[#103963] dark:text-[#20C8F5]' : 'app-nav-inactive text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#163B63]'}`}>
                    {/* La celda fija mantiene la coordenada X incluso al contraer. */}
                    <span className="app-sidebar-icon-slot" aria-hidden="true"><Icon size={19}/></span>
                    <span className={`min-w-0 truncate whitespace-nowrap ${!sidebarWide ? 'md:hidden' : ''}`}>{t(`nav.${link.id}`)}</span>
                  </button>;
                })}
              </div>;
            })}
          </nav>
          {/* El selector se mantiene montado para animar también el cierre.
              No se cierra al salir con el ratón: solo al elegir, Escape o clic fuera. */}
          <div className="app-divider relative hidden shrink-0 border-t pt-3 md:block" ref={sidebarModeRoot}>
            <div id="edumaster-sidebar-modes" role="group" aria-label={t('nav.sidebarMode')}
              data-open={sidebarOptionsOpen} inert={!sidebarOptionsOpen} aria-hidden={!sidebarOptionsOpen}
              className="app-panel app-sidebar-options absolute bottom-full left-0 z-50 mb-2 w-60 space-y-1 rounded-xl border p-2 shadow-xl">
              {([['expanded', PanelLeftOpen], ['collapsed', PanelLeftClose], ['dynamic', Menu]] as const).map(([mode, Icon]) =>
                <button type="button" key={mode} aria-pressed={sidebarMode === mode}
                  onClick={event => {
                    setSidebarMode(mode);
                    setSidebarOptionsOpen(false);
                    setSidebarKeyboardFocus(false);
                    if (event.detail > 0) event.currentTarget.blur();
                    else sidebarModeTrigger.current?.focus();
                  }}
                  className="app-sidebar-mode-option flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm">
                  <Icon size={18} className="shrink-0"/><span className="whitespace-nowrap">{t(`nav.${mode === 'expanded' ? 'expand' : mode === 'collapsed' ? 'collapse' : 'dynamic'}`)}</span>
                </button>)}
            </div>
            <button ref={sidebarModeTrigger} type="button" aria-expanded={sidebarOptionsOpen}
              aria-controls="edumaster-sidebar-modes" aria-label={t('nav.sidebarMode')}
              title={t('nav.sidebarMode')}
              onClick={() => setSidebarOptionsOpen(open => !open)}
              className="app-sidebar-mode-button app-secondary-button flex min-h-11 w-full min-w-0 flex-nowrap items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left text-sm">
              <span className="flex size-[19px] shrink-0 items-center justify-center">
                {sidebarMode === 'expanded' ? <PanelLeftClose size={19} className="shrink-0"/> : <PanelLeftOpen size={19} className="shrink-0"/>}
              </span>
              <span className={`${sidebarWide ? '' : 'md:hidden'} min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap`}>{t('nav.sidebarMode')}</span>
              <ChevronDown size={16} aria-hidden="true" className={`${sidebarWide ? '' : 'md:hidden'} shrink-0 transition-transform ${sidebarOptionsOpen ? 'rotate-180' : ''}`}/>
            </button>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="app-header sticky top-0 z-20 flex min-h-[64px] flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:min-h-20 sm:gap-3 sm:px-5 sm:py-0 md:px-8 dark:border-[#163B63] dark:bg-[#081B35]/95">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" className="shrink-0 rounded-lg p-1.5 sm:p-2 md:hidden" aria-expanded={mobileMenu} aria-controls="edumaster-sidebar" aria-label={t('labels.k7af767cd6a')} onClick={() => setMobileMenu(true)}><Menu size={22}/></button>
            <div className="min-w-0"><div className="app-meta-text text-[10px] leading-tight text-slate-400 sm:text-xs"><strong className="font-bold uppercase">{headerPath ?? t(currentCategoryKey)}</strong></div><h1 className="truncate text-base font-bold leading-tight sm:text-xl">{title}</h1>
              {['courses','students','enrollments','activity','income'].includes(section) && academicOrgId &&
                <p className="app-muted mt-0.5 max-w-56 truncate text-xs sm:max-w-96" title={orgs.find(org=>org.id===academicOrgId)?.name}>
                  {orgs.find(org=>org.id===academicOrgId)?.name}
                </p>}</div>
          </div>
          <div className="flex items-center gap-2">
            {accessToken && <NotificationInbox key={`notifications:${session.user.id}`} token={accessToken}/>}
            <AccountMenu key={`account:${session.user.id}`} identity={accountIdentity} roleLabel={accountRoleLabel} userId={session.user.id} photo={avatar.photo} photoLoading={avatar.loading}
              onProfile={() => navTo('profile')} onSignOut={signOut}/>
          </div>
        </header>
        <main key={section} className="module-enter mx-auto w-full app-content-container space-y-6 py-6">
          {section === 'dashboard' && <DashboardPage key={`${session.user.id}:${academicOrgId}`} userId={session.user.id} name={accountIdentity.name} token={accessToken} globalRoles={globalRoles} memberships={memberships} organizationId={academicOrgId} organizations={orgs} loading={loadingOrgs} error={orgError} apiStatus={apiStatus} access={navigationAccess} onNavigate={navTo}/>}
          {sectionPermissionDenied && <section role="alert" className="app-warning rounded-2xl border p-6">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={20}/> {({es:'Acceso restringido',en:'Access restricted',pt:'Acesso restrito'})[academicLanguage]}</div>
            <p className="mt-2 text-sm">{({es:'No tienes permisos para acceder a este módulo. Consulta al administrador de tu institución.',en:'You do not have permission to access this module. Contact your institution administrator.',pt:'Você não tem permissão para acessar este módulo. Consulte o administrador da sua instituição.'})[academicLanguage]}</p>
          </section>}
          {section === 'organizations' && !sectionPermissionDenied && canOpenInstitutions && <OrganizationsPage
            organizations={orgs} loading={loadingOrgs} error={orgError}
            activeOrganizationId={academicOrgId} onChooseOrganization={selectAcademicInstitution}
            canManage={globalRoles.includes('superadmin')}
            onSave={saveOrganization}
          />}
          {section === 'users' && !sectionPermissionDenied && accessToken && usersCsvImportRoute && <UsersCsvImportPage
            token={accessToken} organizations={globalRoles.includes('superadmin') ? orgs : institutionalAdminOrganizations}
            organizationId={globalRoles.includes('superadmin') ? undefined : academicOrgId}
            globalAdmin={globalRoles.includes('superadmin')}/>}
          {section === 'users' && !sectionPermissionDenied && accessToken && !usersCsvImportRoute && (globalRoles.includes('superadmin')
            ? <UsersPage token={accessToken} organizations={orgs} canManage/>
            : <InstitutionalUsersPage token={accessToken} organizations={institutionalAdminOrganizations} organizationId={academicOrgId}/>)}
          {section === 'income' && !sectionPermissionDenied && <Suspense fallback={<Spinner label={t('common.loading')}/>}><IncomeDemoPage key={`${session.user.id}:${academicOrgId}`}/></Suspense>}
          {section === 'intelligence' && !sectionPermissionDenied && <Suspense fallback={<Spinner label={t('common.loading')}/>}>
            <NeuralNetworkPage token={accessToken??undefined} canRegister={globalRoles.includes('superadmin')} organizations={orgs}/>
          </Suspense>}
          {section === 'settings' && <SettingsPage token={accessToken ?? ''} apiStatus={apiStatus} onCheckApi={checkApi}/>}
          {section === 'profile' && accessToken && <ProfilePage key={session.user.id} identity={accountIdentity} token={accessToken}
            userId={session.user.id} photo={avatar.photo} photoLoading={avatar.loading} onIdentity={value => setIdentity({ id: session.user.id, value })}
            onSavePhoto={avatar.save} onRemovePhoto={avatar.remove}/>}
          {section === 'courses' && !sectionPermissionDenied && newLessonRoute && accessToken && <Suspense fallback={<Spinner label={t('common.loading')}/>}>
            <LessonCreatePage key={`${newLessonRoute.unitId}:${newLessonRoute.source}`} {...newLessonRoute} token={accessToken} onConfirmSignOut={completeSignOut}/>
          </Suspense>}
          {section === 'courses' && !sectionPermissionDenied && lessonRoute && accessToken && <Suspense fallback={<Spinner label={t('lessonEditor.loading')}/>}>
            <LessonEditorPage key={`${lessonRoute.lessonId}:${lessonRoute.source}`} {...lessonRoute} token={accessToken} onConfirmSignOut={completeSignOut}/>
          </Suspense>}
          {section === 'courses' && !sectionPermissionDenied && taskSubmissionsRoute && accessToken && <Suspense fallback={<Spinner label={reviewNames.list}/>}>
            <TaskSubmissionsPage {...taskSubmissionsRoute} token={accessToken} favoriteScopes={favoriteScopes(taskSubmissionsRoute.organizationId)}/>
          </Suspense>}
          {/* Los favoritos antiguos /mis-entregas siguen abriendo la tarea autorizada. */}
          {section === 'courses' && !sectionPermissionDenied && myTaskSubmissionsRoute && accessToken && <Suspense fallback={<Spinner label={reviewNames.taskDetail}/>}>
            <CourseTaskPage key={`${myTaskSubmissionsRoute.offeringId}:${myTaskSubmissionsRoute.taskId}`} {...myTaskSubmissionsRoute} token={accessToken} favoriteScopes={favoriteScopes(myTaskSubmissionsRoute.organizationId)}/>
          </Suspense>}
          {section === 'courses' && !sectionPermissionDenied && courseTaskRoute && accessToken && <Suspense fallback={<Spinner label={reviewNames.taskDetail}/>}>
            <CourseTaskPage key={`${courseTaskRoute.offeringId}:${courseTaskRoute.taskId}`} {...courseTaskRoute} token={accessToken} favoriteScopes={favoriteScopes(courseTaskRoute.organizationId)}/>
          </Suspense>}
          {section === 'courses' && !sectionPermissionDenied && taskReviewRoute && accessToken && <Suspense fallback={<Spinner label="Cargando entrega..."/>}>
            <TaskSubmissionReviewPage {...taskReviewRoute} token={accessToken}/>
          </Suspense>}
          {section === 'courses' && !sectionPermissionDenied && courseRoute && accessToken && <CourseWorkspacePage key={location.pathname+((new URLSearchParams(location.search).has('recommendation')||new URLSearchParams(location.search).has('post'))?location.key:'')}
            organizationId={courseRoute.organizationId} courseId={courseRoute.courseId} offeringId={courseRoute.offeringId} token={accessToken} favoriteScopes={favoriteScopes(courseRoute.organizationId)}/>}
          {((section === 'courses' && !courseRoute && !lessonRoute && !newLessonRoute && !taskReviewRoute && !taskSubmissionsRoute && !myTaskSubmissionsRoute && !courseTaskRoute) || section === 'students' || section === 'enrollments') && !sectionPermissionDenied && accessToken && <AcademicPage
            mode={section} organizations={orgs} organizationId={academicOrgId}
            token={accessToken}
            courseRole={academicRole(academicOrgId)}
            canManageOrganization={canManageAcademicOrganization}/>}
          {section === 'activity' && !sectionPermissionDenied && accessToken && <AcademicActivityPage
            organizationId={detailRoute?.organizationId ?? academicOrgId} token={accessToken}
            selectedEnrollmentId={detailRoute?.enrollmentId ?? ''}
            selectedOfferingId={detailRoute?.offeringId ?? ''}
            onSelectEnrollment={(offeringId, enrollmentId) => navigate(enrollmentHistoryPath(detailRoute?.organizationId ?? academicOrgId, offeringId, enrollmentId))}
            onBackToOverview={() => navTo('activity')}/>}
          {section === 'security' && !sectionPermissionDenied && <div className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D]">
            <LockKeyhole size={24} className="app-accent text-[#20C8F5]"/><h3 className="mt-3 text-lg font-semibold">{t('legacy.k58c0760579')}</h3>
            <p className="mt-2 text-sm leading-7 app-muted text-slate-500 dark:text-slate-300">{t('legacy.k71ac295807')}</p>
            <button type="button" onClick={() => setShowPermissions(true)} className="app-secondary-button mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600">{t('legacy.k9027157396')} <ChevronDown size={16}/></button>
          </div>}
          <footer className="app-page-footer flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-[#23456A] dark:text-slate-400"><span>{t('legacy.kf8b93dcae3')}</span><span>{t('legacy.k5bf7b8d7ea')}</span></footer>
        </main>
      </div>
    </div>
    <Modal open={showPermissions} title="Controles por completar" onClose={() => setShowPermissions(false)}>
      <ul className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-200">
        <li>{t('legacy.k96cbba7acb')}</li>
        <li>{t('legacy.k20d5153595')}</li>
        <li>{t('legacy.k4fdfe45630')}</li>
        <li>{t('legacy.k7b143d1214')}</li>
      </ul>
    </Modal>
  </div>;
}

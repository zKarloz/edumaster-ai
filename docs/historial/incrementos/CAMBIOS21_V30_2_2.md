# CAMBIOS 21 — EduMaster.ai v30.2.2

## Objetivo

Mejorar la usabilidad de Cursos/Tareas después de v30.2.1 sin alterar
el esquema, las calificaciones oficiales ni las autorizaciones existentes.

## Cambios

1. **Inicio de sesión**: se sigue revalidando el JWT con FastAPI en cada
   recarga (obligatorio), pero la pantalla de espera se sustituye por un
   esqueleto sin datos privados. Las renovaciones normales de token de la
   misma identidad no bloquean la vista. `401/403` siguen revocando acceso.
2. **Editor táctil**: toolbar Tiptap aplica formato en el gesto táctil antes
   de que Safari retire el foco; se evita ejecutar dos veces el clic sintético.
   Estados `aria-pressed` y colores explícitos de alto contraste para los
   tres temas Claro/Oscuro/Negro; conserva acciones de mouse/teclado.
3. **Archivos**: las URL firmadas dejan de almacenarse en el estado de React.
   Cada pulsación «Abrir archivo» solicita una URL nueva a FastAPI y valida
   origen y ruta del bucket privado. Errores al obtenerla muestran un aviso.
   Las URL firmadas siguen expirando en Storage al cabo de 60 segundos: una
   pestaña externa que se actualice tras ese plazo puede mostrar un error de
   Supabase; se recomienda volver a EduMaster y pulsar «Abrir archivo».
4. **Toasts con modales**: el proveedor compartido crea un portal a `body`
   por encima de la capa modal (`11000 > 10000`) sin perder accesibilidad.
5. **Estilos de Cursos**: tarjetas, fechas, estados, formularios, adjuntos,
   unidades y lecciones con contraste y bordes explícitos en los tres temas.
6. **Revisión docente**: página profunda de revisión con respuesta completa,
   archivos y observaciones. Nueva API de consulta por ID validada con el
   mismo rol docente de la lista y filtros de organización/oferta/tarea/entrega.
   La URL no concede permisos. Al volver se reabre la lista y página de origen.
7. **Modales**: se retiran botones «Volver» redundantes en «Mis entregas» y
   «Ver entregas», conservando la «X» accesible.

## Pruebas y límites

- Backend: 346 pruebas (incluye restricciones del nuevo endpoint).
- Frontend: 21 pruebas de editor, 10 de tareas y análisis sintáctico TS/TSX.
- La compilación real `npm run build`, Ruff y las pruebas táctiles/visuales
  requieren el entorno del usuario; no se presentan como aprobadas aquí.
- No se modifica Supabase, Storage, los archivos privados ni la configuración
  de credenciales. No se requiere ningún SQL.

## Aceptación manual

- Recargar sesión iniciada: estructura visual estable hasta /me; sin exponer datos.
- Touch en iOS/Android: negrita/cursiva/subrayado resaltan antes de escribir.
- Reabrir PDF tras un minuto: el botón emite una URL NUEVA; no reutilizar pestaña externa.
- Quitar adjunto pendiente dentro del modal: toast visible, sin desenfoque.
- Verificar colores Claro/Oscuro/Negro en tareas, modales y unidades de contenido.
- Como docente, abrir «Revisar» en página; recargar URL y regresar a lista;
  verificar que un estudiante no pueda usar la URL docente.
- «Mis entregas» y «Ver entregas»: solo X de cierre en el modal.

## Publicación

Si v30.2.1 aún está sin commit, el commit puede incluir ambos cambios. No
hacer push antes de pasar Ruff, build, tests y pruebas funcionales.

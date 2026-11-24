# CAMBIOS 21 · v30.2.3 — Ajustes finales de Cursos

Base: **CAMBIOS 21 v30.2.2 instalado**. No requiere nuevas migraciones, credenciales ni paquetes npm.

## Cambios

1. El visor de una lección publicada muestra un contorno propio de alto contraste en Claro, Oscuro y Negro.
2. Durante la revalidación de una sesión existente vuelve a aparecer la pantalla de autorización con foto/nombre del usuario, en lugar del esqueleto anónimo. La comprobación real de `/api/v1/me` continúa siendo obligatoria. En el arranque anterior a recuperar la sesión se muestra el indicador de restauración.
3. `Revisar entregas` ya no es modal: `/academico/organizaciones/:org/ofertas/:oferta/tareas/:tarea/entregas` permite abrir el listado y navegar por sus páginas. El backend revalida el rol y la oferta en cada petición.
4. Al abrir un intento individual se utiliza la página existente `/entregas/:entrega/revisar`. «Volver a entregas» aparece **a la izquierda**, vuelve al listado y conserva `?page=`. El título «Revisar entrega» y su ruta están en el topbar general.
5. Las pestañas Inicio, Contenido y Actividades y tareas mantienen su ancho natural en móviles, con desplazamiento horizontal táctil y sin reducir los iconos.

## Validaciones recomendadas

- En una sesión existente, recargar: muestra foto/nombre del usuario durante la comprobación, sin presentar contenido privado antes de autorizar.
- En Cursos → Contenido, expandir una unidad y abrir «Ver lección publicada»: comprobar su contorno en los tres temas.
- En un móvil estrecho, desplazar las pestañas horizontalmente, con títulos completos y símbolos no recortados.
- Como docente asignado, abrir «Revisar entregas», pasar a página 2 si hay suficientes registros, abrir una entrega y regresar: debe mantenerse la página.
- Actualizar la URL directa del listado y del detalle; ambas deben cargar sin pasar antes por el curso.
- Como estudiante o docente de otra oferta, el backend debe denegar las consultas del listado/detalle ajeno.
- Confirmar que el resto de modales (enviar entrega y mis entregas) sigue funcionando.

## Comprobación local

En `apps/web`:

```bash
npm run build
npm run test:editor
npm run test:tasks
```

En `apps/api`:

```bash
python -m ruff check app tests
python -m pytest -q
```

No ejecutar SQL de nuevo. El commit/push se hace únicamente tras los resultados locales y la prueba visual.

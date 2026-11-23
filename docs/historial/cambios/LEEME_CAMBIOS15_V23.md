# EduMaster.ai — CAMBIOS 15 / v23

Parche incremental sobre la versión v22; frontend exclusivamente.

## Cambios

- Perfil responsivo: avatar centrado en móvil, nombre y correo debajo centrados.
- Usuarios institucionales: acciones en una única fila sin saltos; la tabla conserva desplazamiento horizontal.
- Topbar compacto en teléfonos sin reducir el título en tablet o PC.
- Modo de navegación oculto por debajo de 768 px; permanece en tablet (p. ej. iPad Mini de 768 px) y escritorio.
- Nuevo componente compartido `BottomSheet.tsx`: usa el modal y la capa de fondo existentes para presentar un panel desde abajo en móviles (menos de 640 px) y un diálogo centrado desde 640 px.
- La fotografía abre un menú Ver foto / Cambiar foto / Quitar; eliminar solo es posible cuando hay foto.
- Nombre completo usa el mismo diálogo adaptable.
- El cambio y eliminación de fotografías sigue usando Supabase Storage privado, sin nuevos permisos.

## Instalación y validación

1. Descomprime el parche sobre `edumaster-ai` v22 conservando rutas. No reemplaza `.env`.
2. Desde `apps/web`: `npm run build` y `npm run dev`.
3. Prueba: teléfono 375×812, teléfono 430×932, iPad Mini 768×1024 y escritorio. Comprueba Perfil, acciones de usuarios, Escape/clic fuera y estilos Claro/Oscuro/Negro.
4. Desde la raíz del proyecto:

```bash
git add apps/web/src/App.tsx apps/web/src/styles.css apps/web/src/components/shared/Modal.tsx apps/web/src/components/shared/ModalBackdrop.tsx apps/web/src/components/shared/BottomSheet.tsx apps/web/src/modules/profile/ProfilePage.tsx apps/web/src/modules/users/InstitutionalUsersPage.tsx apps/web/src/i18n.ts LEEME_CAMBIOS15_V23.md
git commit -m "feat(interfaz): mejorar perfil y navegación en pantallas pequeñas"
git push origin main
```

No requiere SQL, nuevas dependencias npm ni configuración de Render o Vercel. Validar `npm run build` antes del push.

# CAMBIOS 27 v1.0 — Comunidad: perfiles y paginación

- Fotografías de autores de publicaciones y comentarios mediante el bucket privado existente, `useAvatar` y `UserAvatar`. Si no hay foto o la lectura es rechazada, se muestran iniciales.
- Modal académico mínimo con nombre y foto, accesible desde el nombre o avatar. No usa el directorio administrativo ni expone correo, datos privados o roles globales.
- Paginación de publicaciones desde FastAPI con 5, 10 o 20 por página (5 por defecto), total visible, navegación anterior/siguiente y orden estable por fecha e ID. Si la página deja de existir, el servidor ajusta a la última disponible. Los comentarios mantienen su límite de 100.
- La migración 017 agrega una política SELECT al bucket privado únicamente para autores activos de contenido visible en ofertas a las que el solicitante tiene acceso. No modifica las políticas anteriores ni concede escritura o acceso directo a tablas académicas.
- Aplicar migración 017 después de 016 y antes de desplegar. Desplegar backend y frontend del mismo incremento; no se necesita instalar dependencias.
- Verificar con cuentas reales de docente, estudiante y otra institución: fotos, perfiles, paginación, moderación, ausencia de acceso cruzado. El modal muestra solo la identidad académica mínima; la ficha administrativa permanece restringida.
- Comprobaciones locales: 414 pruebas Python con SQL simulado y 145 pruebas Node; sintaxis TSX. Pendientes: Ruff, compilación completa, ejecución SQL en Supabase y validación visual/funcional con cuentas reales.

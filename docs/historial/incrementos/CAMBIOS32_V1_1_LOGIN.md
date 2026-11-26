# CAMBIOS 32 v1.1 — Login

Incremento sobre 32 v1.0. Panel fotográfico izquierdo y formulario existente a la derecha. Se reutiliza `hero-students.jpg` (fuente y licencia documentadas en `apps/web/public/images/landing/README.md`). Si no existe, ejecutar `bash scripts/download-landing-photos.sh` desde `apps/web`; el panel tiene respaldo de color si falla la imagen.

Carrusel CSS de seis capacidades, dos grupos iguales y desplazamiento de izquierda a derecha en 45 segundos. Pausa manual y al pasar el cursor, respeto de las preferencias de movimiento y del sistema; en modo estático se permite scroll horizontal. En pantallas pequeñas se oculta el carrusel para priorizar el formulario. Los textos se traducen en ES/EN/PT; la zona fotográfica mantiene contraste oscuro en todos los temas.

No cambia App.tsx, rutas, callbacks de autenticación, PasswordInput, Supabase, dependencias ni variables de entorno. No se añade recuperación de contraseña nueva.

Validación: 167 pruebas Node aprobadas (incluidas dos estructurales nuevas), transpilación TSX sin diagnósticos. Compilación completa y prueba visual/autenticación real pendientes por falta de dependencias npm en el entorno de revisión. Comprobar en escritorio y móvil, tres temas, idiomas, pausa, reducción de movimiento, credenciales válidas e inválidas y retorno a portada.

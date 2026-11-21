# EduMaster.ai — Hotfix académico v11.1

Correcciones sobre el incremento académico v11; aplicar **solo al frontend**.

## Soluciones

1. **TS2532 (`noUncheckedIndexedAccess`)**: comprobar `firstOrganization` antes de acceder a `.id` en `AcademicPage.tsx`.
2. **Matrículas**: tarjeta de requisitos en ámbar **suave** (temas Claro, Oscuro y Negro), solo después de cargar los registros de la institución. El botón requiere al menos un estudiante **activo** y un curso publicado con oferta abierta.
3. **Estudiantes**: aviso de orientación en azul tenue en temas Claro/Oscuro, gris en Negro. **No es una advertencia de error**. Ya no ocupa espacio permanentemente: solo aparece en la página cuando la institución no tiene estudiantes, después de cargar los datos. Dentro del modal «Incorporar estudiante» la instrucción sigue disponible siempre, para prevenir confusión con la creación de cuentas.
4. Nuevas clases compartidas `app-warning` y `app-info` en `styles.css`, sin introducir librerías.

## Instalación

Este ZIP incluye el prefijo `edumaster-ai/`. Extrae en la carpeta **que contiene** tu directorio `edumaster-ai`, no dentro de él; o copia los dos archivos a sus rutas originales.

- `edumaster-ai/apps/web/src/modules/academic/AcademicPage.tsx`
- `edumaster-ai/apps/web/src/styles.css`

No reemplaza archivos `.env`, no requiere nueva migración SQL y no añade paquetes npm.

Desde la carpeta `edumaster-ai/apps/web` en Git Bash:

```bash
npm run build
npm run dev
```

## Comprobaciones

- La sintaxis TS/TSX y CSS de los archivos fue analizada localmente.
- La comprobación independiente de `noUncheckedIndexedAccess` pasó con TypeScript en modo estricto.
- El build completo del frontend requiere las dependencias instaladas en tu VSCode; no fue ejecutado aquí.

## Pruebas manuales

- En **Matrículas**, sin estudiantes activos o sin curso ofertado abierto, el aviso debe verse ámbar suave y el botón debe permanecer deshabilitado.
- Tras cumplir ambos requisitos, desaparece el aviso y se habilita «Nueva matrícula».
- En **Estudiantes**, con directorio vacío, debe verse el aviso informativo (azul tenue en Claro/Oscuro, neutro en Negro).
- Al incorporar el primer estudiante, la tarjeta de la página debe desaparecer; la instrucción permanece disponible dentro del modal.
- Si cambias de institución, los avisos no deben aparecer durante la carga de datos.

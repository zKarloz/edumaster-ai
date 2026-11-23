# EduMaster.ai — Corrección TypeScript v18.1

Parche incremental sobre **CAMBIOS 10 / v18**. Corrige los tres errores `TS2345` de `AcademicActivityPage.tsx` (líneas originales 242, 254 y 315), causados porque una búsqueda en `states` puede devolver `undefined` y `t()` solo admite claves definidas.

## Cambio

Se añade `statusLabel(status)` dentro del componente para traducir estados conocidos y devolver el valor original cuando el estado no está en el diccionario, o `—` si está ausente. Las tres vistas comparten esta función y se evita llamar a `t(undefined)` sin usar conversiones inseguras ni desactivar reglas de TypeScript.

## Instalación

1. Descomprime el ZIP del parche **sobre la carpeta que contiene `edumaster-ai`** (o copia el archivo conservando la ruta). Reemplaza `apps/web/src/modules/academic/AcademicActivityPage.tsx`.
2. Desde `apps/web` ejecuta `npm run build`.
3. Solo después de que compile, desde la raíz del repositorio:

```bash
git add apps/web/src/modules/academic/AcademicActivityPage.tsx
git commit -m "fix(interfaz): corregir tipado de estados académicos traducidos"
git push origin main
```

**No requiere** SQL, modificación de `.env`, instalación de dependencias, cambios en FastAPI ni modificaciones en Supabase. La compilación Vite real debe comprobarse localmente y en GitHub Actions.

# EduMaster.ai — CAMBIOS 5

## Contenido

Solo se modifica el **frontend**: no ejecutar SQL ni sustituir `.env`.

- Contenedor general: ancho máximo de **1600 px**, con márgenes laterales responsive de `clamp(28px, 3.5vw, 56px)`; en móviles, 16 px.
- Tema Negro: divisor entre filtros y listado institucional en gris.
- Nuevo `components/shared/OptionSelect.tsx`: desplegable uniforme con un **máximo de tres opciones visibles**. El resto se consulta desplazando el menú. Soporta flechas, Enter, Escape, Home/End. Se usa en el filtro y el formulario de países. Conserva «Otro país (código ISO)» para países no incluidos en el catálogo frecuente.
- Retiradas las etiquetas visibles de Sprint de las cabeceras; las fases quedan documentadas pero no visibles para usuarios finales.
- Nuevo `components/shared/ModalBackdrop.tsx`: oscurecimiento/desenfoque uniforme para todos los modales que utilicen `Modal.tsx`.
- Configuración > Fondo de las ventanas emergentes: **Desenfoque suave** (por defecto) o **Sombreado básico**. La preferencia persiste por usuario y navegador en `localStorage`, sin cambio de esquema.

## Cómo ajustar los márgenes tú mismo

En `apps/web/src/styles.css` busca, al final del archivo:

```css
:root {
  --module-max-width: 1600px;
  --module-side-gap: clamp(28px, 3.5vw, 56px);
}
```

- `--module-max-width`: es el ancho **exterior** máximo del contenedor; bájalo a `1540px` si quieres más aire en monitores anchos, o súbelo a `1640px` para más espacio de contenido.
- `--module-side-gap`: es la separación **interior** respecto de los bordes del módulo (ya considera el sidebar). El primer número es el mínimo, `3.5vw` se adapta a la pantalla, y el último es el máximo.
- Más separación: `clamp(32px, 4vw, 64px)`.
- Menos separación: `clamp(20px, 2.5vw, 44px)`.
- En móviles se aplica `--module-side-gap: 16px` en una regla `@media`; puedes conservar ese valor.

Guarda (`Ctrl+S`): Vite actualiza los estilos automáticamente con `npm run dev`.

## Instalación

1. Respaldar `apps/web/src` actual.
2. Extraer el ZIP del parche en la raíz del proyecto, preservando carpetas.
3. Abrir una terminal Git Bash en `apps/web` y ejecutar:

```bash
npm run build
npm run dev
```

No se agregaron dependencias. Tampoco se necesita actualizar la API ni la base de datos.

## Casos de prueba manual

- Probar módulos con sidebar expandido y plegado; confirmar márgenes visibles en ambos lados.
- Abrir Instituciones en Negro: divisor de filtros y selección en gris.
- Abrir Nueva institución > País: lista de a lo sumo tres filas con scroll y opción «Otro país».
- Probar el selector con teclado y la selección de un país de la parte inferior de la lista.
- Probar el filtro por país con el mismo estilo.
- Verificar que ningún título de módulo muestre texto de Sprint.
- Cambiar Configuración > fondo del modal a «Sombreado básico»; abrir Nueva institución o Seguridad > Ver controles. Confirmar que ambos usan el mismo sombreado, sin desenfoque.
- Activar de nuevo «Desenfoque suave», recargar y confirmar que la opción elegida se conserva.

## Alcance de las verificaciones

Se ha analizado sintácticamente TypeScript/TSX y se ha verificado la estructura del ZIP. La compilación completa con Vite y las pruebas en navegador requieren dependencias npm instaladas; no fueron ejecutables en este entorno debido al acceso a npm.

# CAMBIOS 23 — v31.2.1 · Pulsos eléctricos del visualizador

## Alcance

- Se eliminó el halo circular que se expandía alrededor de la neurona seleccionada.
- Los nodos SVG conservan selección por clic y teclado; el foco por teclado se
  indica subrayando la etiqueta, sin agrandar el contorno de la neurona.
- Las conexiones SVG permanecen **rectas y continuas** en los tres temas.
- Una estela con brillo y núcleo luminoso se desplaza de origen a destino por
  las conexiones activadas secuencialmente, mediante SVG `animateMotion`.
- Pausar/reanudar funciona incluso cuando están activas las tres capas.
- Las preferencias de movimiento reducido y el ajuste de EduMaster desactivan
  las partículas, pero mantienen visibles las conexiones estáticas.

## Naturaleza de la vista

La visualización sigue marcada como **SIMULACIÓN DEMO**. Las conexiones y
pulsos son ilustrativos, no pesos neuronales ni explicaciones predictivas.
No se consultan estudiantes reales ni se altera Supabase, FastAPI o el laboratorio ML.

## Verificación local

Desde `apps/web`:

```bash
npm run build
npm run test:neural
npm run test:editor
npm run test:tasks
npm run test:users
```

Verificar con ratón y teclado en Claro, Oscuro y Negro. Debe haber una señal
luminosa en movimiento **sobre** la línea continua, sin aro creciente al hacer
clic. Probar pausa después de que se iluminen las salidas.

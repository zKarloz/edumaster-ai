# CAMBIOS 23 — v31.5.1

- Vista entrenada: estela, brillo y núcleo reutilizan las clases del visualizador conceptual; el color conserva el signo del peso.
- Duración por etapa: 1840 ms; cada pulso recorre su conexión en 1400–1760 ms. Al reanudar se repite el tramo actual. La animación reproduce inferencias ya calculadas.
- Seleccionar neurona, categoría o conexión reinicia la reproducción. Las preferencias de movimiento se conservan.
- Activaciones y salida con etiqueta oscura opaca, texto claro y borde temático en los tres temas.
- No se modifican pesos, dataset, entrenamiento, dependencias, backend ni Supabase.

Aplicar sobre v31.5 en main. Desde apps/web: `npm run test:neural`, `node --test tests/*.test.cjs`, `npm run build`, `npm run dev`. Entrenar, abrir Modelo entrenado, reproducir, seleccionar entradas, comprobar pausa y reducción de movimiento; revisar etiquetas en los tres temas. Las pruebas estructurales no sustituyen la validación visual.

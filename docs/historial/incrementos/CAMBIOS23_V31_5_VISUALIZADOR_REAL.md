# CAMBIOS 23 — v31.5 · Visualizador del modelo entrenado

Base: v31.4.1. No requiere dependencias nuevas, migraciones ni cambios en Render.

- Selector de vista conceptual y modelo entrenado. El laboratorio permanece montado al cambiar de vista.
- El grafo se construye con las dimensiones de los kernels Dense y las activaciones del ejemplo del mejor checkpoint. Los valores se obtienen del resultado del worker existente.
- El ejemplo se comparte entre el laboratorio y el grafo. Un nuevo entrenamiento invalida el resultado anterior; el modelo no se guarda al abandonar la página.
- Selección de entrada, categoría, neurona oculta, salida o conexión. El enfoque atenúa el dibujo, no modifica las entradas ni recalcula la predicción. La contribución mostrada es el producto local entrada × peso, no una atribución causal.
- Las categorías son agrupaciones didácticas de las características presentes; asistencia y comentarios aún no son entradas. El nivel se codifica con tres indicadores.
- La reproducción por capas representa una inferencia ya calculada, no el tiempo de ejecución ni el entrenamiento. La pausa mantiene la etapa; al continuar se reinicia el pulso de esa etapa. Respeta la configuración de movimiento y la preferencia del sistema.
- Bordes y colores mediante tokens existentes; textos ES/EN/PT. Los nombres técnicos originales permanecen en el laboratorio.

## Aplicación
Extraer sobre la raíz en main (base v31.4.1). Revisar cambios antes de confirmar.

```bash
cd apps/web
npm run test:neural
node --test tests/*.test.cjs
npm run build
npm run dev
```

Verificar vista conceptual, estado sin modelo, entrenamiento, cambio de vista durante entrenamiento, selección del ejemplo 50 en ambas vistas, enfoque sin variar predicción, pesos/sesgos contra el inspector, reproducción y pausa, temas Claro/Oscuro/Negro, teclado y móvil. Verificar que un nuevo entrenamiento cancela el snapshot anterior y que cancelar no deja resultados obsoletos.

Pruebas offline: 112/112 frontend (25 neuronales), incluyendo dos nuevas. Transpilación sintáctica sin diagnósticos. No se han instalado dependencias ni ejecutado build completo o navegador en el entorno de preparación.

Tras validar, desde raíz:

```bash
git status --short
git add .
git diff --cached --stat
git diff --cached --name-only
git commit -m "feat(ai): CAMBIOS 23 v31.5 visualizador neuronal entrenado"
git push origin main
```

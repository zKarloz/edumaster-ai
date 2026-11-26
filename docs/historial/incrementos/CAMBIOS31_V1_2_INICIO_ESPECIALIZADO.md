# CAMBIOS 31 v1.2 — Inicio especializado

- Analista: catálogo de nueve fuentes, sin inventar recuentos ni ampliar permisos. Diagnóstico agregado existente solo si la cuenta también es superadministradora.
- Ingeniero IA: configuración MLP 13→8→4→1, 153 parámetros, dataset sintético 250 filas (150/50/50), acceso al laboratorio sujeto a moduleAccess. No se muestran métricas de entrenamiento ni checkpoints.
- Componentes Panel y Stat, traducciones ES/EN/PT y estilos temáticos existentes. Sin migración, API ni dependencias nuevas.
- Aplicar sobre v31.1. Ejecutar `node --test tests/*.test.cjs`, `npm run build` y comprobar los roles y los tres temas.
- Validación en entorno de revisión: 163 pruebas Node aprobadas, transpilación TSX sin diagnósticos. Compilación completa y navegador pendientes.

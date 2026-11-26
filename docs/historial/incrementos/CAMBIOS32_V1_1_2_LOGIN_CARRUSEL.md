# CAMBIOS 32 v1.1.2 — Desvanecido lateral del Login

Requiere v1.1.1. Aplicar sobre la raíz del repositorio.

La ventana del carrusel utiliza una máscara alfa bilateral con ancho adaptable de 24 a 72 px (7 % de la ventana). La pista conserva su desplazamiento de 45 s y la pausa; las tarjetas y sombras se atenúan al cruzar los bordes. Se conserva la elevación de 5 px y la separación vertical existente. La máscara no depende del color del tema y no afecta a los controles ni al formulario. Se incluye prefijo WebKit. En modo estático o movimiento reducido se elimina la máscara para no ocultar contenido ni el scrollbar.

Sin cambios en autenticación, API, dependencias o SQL. Prueba estructural: `cd apps/web && node --test tests/*.test.cjs`. Validar visualmente ambos extremos, hover, pausa, los tres temas y modo estático. La prueba estructural no sustituye la revisión en navegador.

# CAMBIOS 32 v1.1.1 — Refinamiento visual del Login

Aplicar sobre CAMBIOS 32 v1.1. Sin migraciones ni dependencias.

- La fotografía y su capa de contraste se agrupan en un fondo independiente. En escritorio, la máscara horizontal desvanece el último 25 % del fondo hasta la superficie del tema: Claro #f5f7fb, Oscuro #06152b y Negro #080808. El texto y las tarjetas no reciben la máscara.
- En pantallas pequeñas se conserva la presentación vertical anterior.
- Las tarjetas se elevan 5 px en 190 ms con sombra y borde destacado; el carrusel conserva su pausa al situar el cursor. Se reserva espacio vertical para evitar recortes.
- Se respetan las preferencias de movimiento y no se modifica el formulario ni la autenticación.

Validación: 168 pruebas Node correctas, transpilación TSX sin diagnósticos. Compilación completa bloqueada por dependencias npm ausentes en el entorno; revisar visualmente en navegador los tres temas y el carrusel.

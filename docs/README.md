# Documentación de EduMaster.ai

Este directorio separa **guías vigentes** de **material histórico**. Los documentos del historial
son evidencias de decisiones anteriores; no constituyen instrucciones para volver a ejecutar
migraciones, sobrescribir código o aplicar parches.

## Acceso rápido

- [Inicio e instalación del proyecto](../README.md)
- [Cierre y comprobaciones de v27.1](historial/cambios/CAMBIOS18_CIERRE_V27_1.md)
- [CAMBIOS 19 · v28: estados de contenido y creación por rol](historial/cambios/CAMBIOS19_V28.md)
- [Manual de la base de datos](../database/README.md)

## Arquitectura y diseño inicial

- [ARQUITECTURA_ARRANQUE](arquitectura/ARQUITECTURA_ARRANQUE.md)
- [DECISIONES_SPRINT0](arquitectura/DECISIONES_SPRINT0.md)
- [EduMaster_Sprint0_Diseno_RBAC_ABAC_y_ERD_v1](arquitectura/sprint0/EduMaster_Sprint0_Diseno_RBAC_ABAC_y_ERD_v1.md)

## Historial: cambios de interfaz y funcionalidades

- [CAMBIOS3_IMPLEMENTADOS](historial/cambios/CAMBIOS3_IMPLEMENTADOS.md)
- [CAMBIOS4_MODAL_MAPA_Y_ANCHO](historial/cambios/CAMBIOS4_MODAL_MAPA_Y_ANCHO.md)
- [CAMBIOS5_SELECTORES_MARGENES_MODAL](historial/cambios/CAMBIOS5_SELECTORES_MARGENES_MODAL.md)
- [CAMBIOS6_TEMAS_MAPA_CODIGOS](historial/cambios/CAMBIOS6_TEMAS_MAPA_CODIGOS.md)
- [CAMBIOS7_POPUP_ETIQUETAS_ANIMACIONES](historial/cambios/CAMBIOS7_POPUP_ETIQUETAS_ANIMACIONES.md)
- [LEEME_CAMBIOS10_V18](historial/cambios/LEEME_CAMBIOS10_V18.md)
- [LEEME_CAMBIOS11_V19](historial/cambios/LEEME_CAMBIOS11_V19.md)
- [LEEME_CAMBIOS12_V20](historial/cambios/LEEME_CAMBIOS12_V20.md)
- [LEEME_CAMBIOS13_V21](historial/cambios/LEEME_CAMBIOS13_V21.md)
- [LEEME_CAMBIOS14_V22](historial/cambios/LEEME_CAMBIOS14_V22.md)
- [LEEME_CAMBIOS15_V23](historial/cambios/LEEME_CAMBIOS15_V23.md)
- [LEEME_CAMBIOS16_V24](historial/cambios/LEEME_CAMBIOS16_V24.md)
- [LEEME_CAMBIOS17_V25](historial/cambios/LEEME_CAMBIOS17_V25.md)
- [LEEME_CAMBIOS18_V27](historial/cambios/LEEME_CAMBIOS18_V27.md)
- [LEEME_CAMBIOS8_V15](historial/cambios/LEEME_CAMBIOS8_V15.md)
- [LEEME_CAMBIOS9_V17](historial/cambios/LEEME_CAMBIOS9_V17.md)
- [TAREA-11-CAMBIOS-2_IMPLEMENTADOS](historial/cambios/TAREA-11-CAMBIOS-2_IMPLEMENTADOS.md)
- [TAREA-11-CAMBIOS_IMPLEMENTADOS](historial/cambios/TAREA-11-CAMBIOS_IMPLEMENTADOS.md)

## Historial: incrementos académicos, usuarios y perfil

- [AUTENTICACION_Y_SUPERADMIN_SPRINT1](historial/incrementos/AUTENTICACION_Y_SUPERADMIN_SPRINT1.md)
- [INCREMENTO_ACADEMICO_V11](historial/incrementos/INCREMENTO_ACADEMICO_V11.md)
- [LEEME_ESPACIO_ACADEMICO_V26](historial/incrementos/LEEME_ESPACIO_ACADEMICO_V26.md)
- [LEEME_INCREMENTO_ACADEMICO_V11](historial/incrementos/LEEME_INCREMENTO_ACADEMICO_V11.md)
- [LEEME_INCREMENTO_ACADEMICO_V16](historial/incrementos/LEEME_INCREMENTO_ACADEMICO_V16.md)
- [LEEME_INCREMENTO_USUARIOS_V12](historial/incrementos/LEEME_INCREMENTO_USUARIOS_V12.md)
- [LEEME_INCREMENTO_USUARIOS_V13](historial/incrementos/LEEME_INCREMENTO_USUARIOS_V13.md)
- [LEEME_PERFIL_V14](historial/incrementos/LEEME_PERFIL_V14.md)
- [LEEME_SEGURIDAD_CONTRASENAS_V15_1](historial/incrementos/LEEME_SEGURIDAD_CONTRASENAS_V15_1.md)
- [MAPA_INSTITUCIONES_SPRINT1](historial/incrementos/MAPA_INSTITUCIONES_SPRINT1.md)
- [USUARIOS_ADMINISTRADORES_V12](historial/incrementos/USUARIOS_ADMINISTRADORES_V12.md)
- [USUARIOS_INSTITUCIONALES_V13](historial/incrementos/USUARIOS_INSTITUCIONALES_V13.md)

## Historial: hotfixes y parches

- [HOTFIX_ACADEMICO_V11_1](historial/hotfixes/HOTFIX_ACADEMICO_V11_1.md)
- [HOTFIX_V8_REGISTRO_INSTITUCIONES](historial/hotfixes/HOTFIX_V8_REGISTRO_INSTITUCIONES.md)
- [LEEME_APLICAR_PARCHE](historial/hotfixes/LEEME_APLICAR_PARCHE.md)
- [LEEME_CI_RUFF_v15_2](historial/hotfixes/LEEME_CI_RUFF_v15_2.md)
- [LEEME_HOTFIX_I18N_TS_v18_1](historial/hotfixes/LEEME_HOTFIX_I18N_TS_v18_1.md)
- [LEEME_HOTFIX_USUARIOS_V13_1](historial/hotfixes/LEEME_HOTFIX_USUARIOS_V13_1.md)
- [LEEME_HOTFIX_V21_1](historial/hotfixes/LEEME_HOTFIX_V21_1.md)

Los archivos `.diff` históricos se conservan únicamente como referencia.
Las migraciones SQL vigentes siguen en `database/migrations/`.
Los dos PDFs enterprise son documentos fuente externos y no se redistribuyen en este ZIP.

## Diseño y entrega actual · CAMBIOS 20 v29.1

- [Entrega integrada de v29.1 — procedimiento y alcance](diseno/CAMBIOS20_V29_1_ENTREGA.md)

## Historial técnico de revisión (no reinstalar)

- [CAMBIOS 20 · v29.1 — Contratos API y estrategia de revisión](diseno/CAMBIOS20_V29_1_CONTRATOS.md)
- [Migración 009 · Comprobaciones previas (solo lectura)](diseno/009_preflight_lectura.sql)
- [Migración 009 · Comprobaciones posteriores (solo lectura)](diseno/009_postflight_lectura.sql)

La migración `009_lesson_revisions.sql` forma parte de la entrega v29.1. No ejecutarla sin respaldo y sin seguir el procedimiento de instalación.

- [CAMBIOS 20 · Revisión B de migración 009 y endpoints](diseno/CAMBIOS20_V29_1_REVISION_B.md) — documentación en revisión; no ejecutar SQL todavía.

- [CAMBIOS 20 · Revisión C — compatibilidad transaccional y rutas activadas en código](diseno/CAMBIOS20_V29_1_REVISION_C.md) — paquete de revisión, todavía NO INSTALAR.

- [CAMBIOS 20 · Revisión D — editor Tiptap en código](diseno/CAMBIOS20_V29_1_REVISION_D.md) — NO INSTALAR.
- [CAMBIOS 20 · Revisión E — navegación segura y autenticación](diseno/CAMBIOS20_V29_1_REVISION_E.md) — NO INSTALAR.

## CAMBIOS 20 · v29.2 — recursos privados

- [Recursos de lección, seguridad y límites de v29.2](historial/incrementos/CAMBIOS20_V29_2.md)

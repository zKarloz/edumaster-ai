/** Identificadores estables de navegación, independientes del idioma. */
export const LAB_TABS = ['architecture','training','evaluation','inspection','models'] as const;
export type LabTab = typeof LAB_TABS[number];

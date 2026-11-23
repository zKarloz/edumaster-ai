/** Paleta controlada de identidad visual para cursos y ofertas.
 * Los códigos persisten en PostgreSQL; nunca se inyectan colores arbitrarios del API.
 */
import type { CSSProperties } from 'react';
import {
  Atom, BookOpen, Calculator, ChartNoAxesColumnIncreasing, Code2, Earth,
  FlaskConical, HeartPulse, Landmark, Languages, Music, Palette,
  type LucideIcon,
} from 'lucide-react';

export const COURSE_COLORS = {
  blue: '#2563eb', teal: '#0d9488', purple: '#9333ea', amber: '#b45309',
  rose: '#be185d', indigo: '#4f46e5', green: '#15803d', slate: '#475569',
  orange: '#c2410c', cyan: '#0e7490',
} as const;
export const COURSE_ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen, calculator: Calculator, 'code-2': Code2,
  atom: Atom, 'flask-conical': FlaskConical, languages: Languages,
  earth: Earth, landmark: Landmark, palette: Palette, music: Music,
  'heart-pulse': HeartPulse, 'chart-no-axes-column-increasing': ChartNoAxesColumnIncreasing,
};
export type CourseColor = keyof typeof COURSE_COLORS;
export type CourseIcon = keyof typeof COURSE_ICONS;
export const ICON_KEYS = Object.keys(COURSE_ICONS);
export const COLOR_KEYS = Object.keys(COURSE_COLORS) as CourseColor[];

export function courseColor(key?: string | null): string {
  return key && Object.prototype.hasOwnProperty.call(COURSE_COLORS, key)
    ? COURSE_COLORS[key as CourseColor] : COURSE_COLORS.blue;
}

export function courseIcon(key?: string | null): LucideIcon {
  return key && COURSE_ICONS[key] ? COURSE_ICONS[key] : BookOpen;
}

export function courseCardStyle(key?: string | null): CSSProperties {
  return { '--course-accent': courseColor(key) } as CSSProperties;
}

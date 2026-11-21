// Cliente público Supabase: solo se usan URL y publishable key del proyecto.
// No importar service_role ni contraseñas de PostgreSQL al frontend.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

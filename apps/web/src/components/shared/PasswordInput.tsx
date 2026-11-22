/** Campo de contraseña accesible, compartido por Login y Perfil. */
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  autoComplete?: 'current-password' | 'new-password';
  minLength?: number;
  disabled?: boolean;
  required?: boolean;
};

export function PasswordInput({ value, onChange, id, placeholder, autoComplete,
  minLength, disabled, required = true }: Props) {
  const [visible, setVisible] = useState(false);
  return <div className="app-input relative flex items-center overflow-hidden rounded-xl border">
    <input id={id} type={visible ? 'text' : 'password'} value={value}
      onChange={event => onChange(event.target.value)}
      autoComplete={autoComplete} placeholder={placeholder} minLength={minLength}
      disabled={disabled} required={required}
      className="min-h-11 w-full min-w-0 bg-transparent py-2.5 pl-3 pr-12 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    />
    <button type="button" disabled={disabled} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={visible} title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      className="app-secondary-button absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-lg border-0"
      onClick={() => setVisible(previous => !previous)}>
      {visible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}
    </button>
  </div>;
}

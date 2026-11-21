// Solo descarga la foto de la identidad activa; las URLs Blob se liberan al salir.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

const BUCKET = 'profile-avatars';
const path = (id: string) => `${id}/avatar.jpg`;

// Reencode local: miniatura cuadrada, sin EXIF; no se envía el original.
export async function prepareAvatar(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 384;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen.');
    const side = Math.min(bitmap.width, bitmap.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 384, 384);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 384, 384);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .85));
    if (!blob || blob.type !== 'image/jpeg' || blob.size > 256 * 1024) throw new Error('La foto no pudo comprimirse correctamente.');
    return blob;
  } finally { bitmap.close(); }
}

export function useAvatar(userId: string | null) {
  const [image, setImage] = useState<{ id: string; blob: Blob } | null>(null);
  const [finishedFor, setFinishedFor] = useState<string | null>(null);
  const [url, setUrl] = useState<{ id: string; value: string } | null>(null);
  const request = useRef(0);
  const activeUser = useRef(userId);
  activeUser.current = userId;
  useEffect(() => {
    const client = supabase;
    setImage(null);
    setFinishedFor(null);
    if (!client || !userId) return;
    let active = true;
    const version = ++request.current;
    // Un objeto ausente es normal; se conservan las iniciales.
    void client.storage.from(BUCKET).download(path(userId)).then(({ data, error }) => {
      if (active && version === request.current) {
        if (!error && data && data.type === 'image/jpeg') setImage({ id: userId, blob: data });
        setFinishedFor(userId);
      }
    }).catch(() => { if (active && version === request.current) setFinishedFor(userId); });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    if (!image || image.id !== userId) { setUrl(null); return; }
    const value = URL.createObjectURL(image.blob);
    setUrl({ id: image.id, value });
    return () => URL.revokeObjectURL(value);
  }, [image, userId]);
  async function save(file: File) {
    const client = supabase;
    if (!client || !userId) throw new Error('Inicia sesión para actualizar la foto.');
    const blob = await prepareAvatar(file);
    if (activeUser.current !== userId) throw new Error('La sesión cambió. Vuelve a seleccionar la foto.');
    const { error } = await client.storage.from(BUCKET).upload(path(userId), blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '0' });
    if (error) throw new Error('No se pudo cargar la foto. Revisa el bucket privado y sus políticas.');
    if (activeUser.current !== userId) return;
    request.current += 1;
    // Mostrar directamente la versión que acaba de guardarse, sin depender de caché CDN.
    setImage({ id: userId, blob });
    setFinishedFor(userId);
  }
  async function remove() {
    const client = supabase;
    if (!client || !userId) throw new Error('Sesión no disponible.');
    const { error } = await client.storage.from(BUCKET).remove([path(userId)]);
    if (error) throw new Error('No se pudo eliminar la foto.');
    if (activeUser.current !== userId) return;
    request.current += 1;
    setImage(null);
    setFinishedFor(userId);
  }
  return { photo: url?.id === userId ? url?.value ?? null : null,
    loading: Boolean(userId && (finishedFor !== userId || (image?.id === userId && url?.id !== userId))), save, remove };
}

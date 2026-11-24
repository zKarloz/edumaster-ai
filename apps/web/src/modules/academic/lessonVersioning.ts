/** Reglas puras de v29.3, compartidas por el editor y la lectura publicada. */
export function canPublishRevision(hasDraft:boolean,dirty:boolean,saving:boolean,publishing:boolean):boolean {
  return hasDraft&&!dirty&&!saving&&!publishing;
}

/** Solo se aceptan URLs firmadas del bucket privado configurado. */
export function safeCourseResourceUrl(signed:string,supabaseUrl:string|undefined):string {
  if(!supabaseUrl)throw new Error('Supabase URL not configured');
  const origin=new URL(supabaseUrl);
  const target=new URL(signed);
  if(target.origin!==origin.origin||!target.pathname.startsWith('/storage/v1/object/sign/course-resources/'))
    throw new Error('Untrusted signed URL');
  return target.toString();
}

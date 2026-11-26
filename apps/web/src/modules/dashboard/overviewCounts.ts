/** Funciones puras: las alertas se limitan a ofertas abiertas o planificadas. */
export function organizationOverview(rows:readonly {status:string;latitude:number|null;longitude:number|null;student_count?:number|null}[]){
 return {active:rows.filter(r=>r.status==='active').length,suspended:rows.filter(r=>r.status==='suspended').length,archived:rows.filter(r=>r.status==='archived').length,noLocation:rows.filter(r=>r.latitude==null||r.longitude==null).length,noStudents:rows.every(r=>typeof r.student_count==='number')?rows.filter(r=>r.student_count===0).length:null};
}
export function offeringOverview<T extends {status:string;instructor_id:string|null;active_enrollments:number}>(rows:readonly T[]){
 const current=rows.filter(r=>r.status==='open'||r.status==='planned');
 return {open:rows.filter(r=>r.status==='open').length,planned:rows.filter(r=>r.status==='planned').length,closed:rows.filter(r=>r.status==='closed').length,noTeacher:current.filter(r=>!r.instructor_id).length,noEnrollment:current.filter(r=>r.active_enrollments===0).length,attention:current.filter(r=>!r.instructor_id||r.active_enrollments===0)};
}

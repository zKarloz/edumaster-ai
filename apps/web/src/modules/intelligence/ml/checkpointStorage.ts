/** IndexedDB aislado por origen/perfil del navegador. Un checkpoint DEMO por dispositivo. */
import type { LocalCheckpoint } from './checkpoint';
const DB='edumaster-neural-demo';
const STORE='checkpoints';
const KEY='latest';
function openDB():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onerror=()=>reject(request.error);
  let blocked=false;
  request.onblocked=()=>{blocked=true;reject(new Error('IndexedDB blocked'));};
  request.onsuccess=()=>{if(blocked)request.result.close();else resolve(request.result);};
 });
}
async function operate(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest):Promise<unknown>{
 const db=await openDB();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);const request=action(tx.objectStore(STORE));
  tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error??new Error('Transaction aborted'));tx.onerror=()=>reject(tx.error);
 });}finally{db.close();}
}
export const saveCheckpoint=(value:LocalCheckpoint)=>operate('readwrite',store=>store.put(value,KEY));
export const readCheckpoint=()=>operate('readonly',store=>store.get(KEY));
export const deleteCheckpoint=()=>operate('readwrite',store=>store.delete(KEY));

let promise;
function database(){
 if(!promise)promise=new Promise((resolve,reject)=>{const req=indexedDB.open('banting-media-v2',1);req.onupgradeneeded=()=>req.result.createObjectStore('blobs');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 return promise;
}
export async function mediaStore(action,key,value){
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('blobs',action==='get'?'readonly':'readwrite');const store=tx.objectStore('blobs');const req=action==='put'?store.put(value,key):action==='delete'?store.delete(key):action==='clear'?store.clear():store.get(key);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('存储操作已取消'));});
}

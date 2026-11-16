// One cancellable request per local opponent. Search stays off the UI thread.
export class AcePlayer {
 constructor(workerFactory=()=>new Worker(new URL('./ace-worker.js',import.meta.url),{type:'module'})){this.factory=workerFactory;this.version=0;this.worker=null;this.timer=null;}
 cancel(){this.version++;clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.worker=null;}
 play(payload,onMove,onError){
  this.cancel();const id=this.version;let answered=false;
  const fail=()=>{if(id!==this.version)return;this.cancel();onError();};
  try {
   const worker=this.worker=this.factory();
   worker.onerror=fail;
   worker.onmessage=event=>{if(id!==this.version||event.data.id!==id||answered)return;answered=true;worker.terminate();this.worker=null;if(event.data.error||!event.data.move){fail();return;}this.timer=setTimeout(()=>{if(id!==this.version)return;this.timer=null;onMove(event.data.move);},250);};
   worker.postMessage({id,...payload});
  } catch {fail();}
 }
}

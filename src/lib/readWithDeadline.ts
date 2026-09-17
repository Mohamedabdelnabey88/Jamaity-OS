/** Bound read operations even if they stall before fetch (for example on an auth lock).
 * No automatic retry. The caller owns the controller and can cancel on unmount.
 */
export async function readWithDeadline<T>(
 read:()=>PromiseLike<T>, controller:AbortController, timeoutMs=25000
):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 let abort:()=>void=()=>{};
 const cancelled=new Promise<never>((_,reject)=>{
  abort=()=>reject(controller.signal.reason??new DOMException('تم إلغاء الطلب.','AbortError'));
  if(controller.signal.aborted)abort();
  else controller.signal.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>controller.abort(new DOMException('انتهت مهلة الاتصال. أعد المحاولة.','TimeoutError')),timeoutMs);
 });
 try{
  if(controller.signal.aborted) return await cancelled;
  return await Promise.race([Promise.resolve().then(()=>read()),cancelled]);
 }finally{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);}
}

export async function ensureFreshServiceWorker(){
 if(!('serviceWorker' in navigator))return;
 const registration=await navigator.serviceWorker.register('/sw.min.js',{updateViaCache:'none'});
 await registration.update();
 const pending=registration.installing||registration.waiting;
 if(pending&&pending.state!=='activated'){
  pending.postMessage('SKIP_WAITING');
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('安全连接初始化超时，请刷新页面后重试。')),20000);const check=()=>{if(pending.state==='activated'){clearTimeout(timer);resolve();}else if(pending.state==='redundant'){clearTimeout(timer);reject(new Error('页面更新未完成，请刷新重试。'));}};pending.addEventListener('statechange',check);check();});
 }
 await navigator.serviceWorker.ready;
}

import {ensureFreshServiceWorker} from '/admin/private/service-worker-guard.mjs';
try{
 await ensureFreshServiceWorker();
 const script=document.createElement('script');script.src='/admin/private/vendor/sveltia-cms.js';document.body.append(script);
}catch(error){
 const message=document.createElement('p');message.textContent=error.message;message.style.padding='32px';document.getElementById('nc-root').append(message);
}

import {ensureFreshServiceWorker} from './service-worker-guard.mjs';
await ensureFreshServiceWorker();
import purify from './vendor/purify.mjs';
import {createGitHubReader,renderMarkdown} from './reader-core.mjs';
const $=selector=>document.querySelector(selector);
let client,controller,session=0,articles=[],objectURLs=[];
const setMessage=message=>{$('#message').textContent=message;};
const clearMedia=()=>{for(const url of objectURLs)URL.revokeObjectURL(url);objectURLs=[];};
function signOut(){session++;controller?.abort();client?.clear();client=undefined;articles=[];clearMedia();$('#article-list').replaceChildren();$('#article').replaceChildren();$('#workspace').hidden=true;$('#login-panel').hidden=false;$('#logout').hidden=true;$('#account').textContent='';$('#access-token').value='';$('#search').value='';setMessage('已退出，页面中的私密内容已清除。');}
async function openArticle(item){
  const current=session;clearMedia();
  const article=$('#article');article.replaceChildren();
  const title=document.createElement('h1');title.textContent=item.article.title;
  const date=document.createElement('p');date.className='article-date';date.textContent=item.article.date;
  const body=document.createElement('div');body.className='prose';body.append(renderMarkdown(item.article.body,{purify,document}));
  article.append(title,date,body);
  for(const img of body.querySelectorAll('img[data-private-media]')){
    try{const blob=await client.image(img.dataset.privateMedia);if(current!==session)return;if(blob){const url=URL.createObjectURL(blob);objectURLs.push(url);img.src=url;}else img.alt='暂不支持此图片格式';}
    catch{if(current===session)img.alt='图片暂时无法读取';}
  }
}
function showList(){
  const query=$('#search').value.trim().toLowerCase();const list=$('#article-list');list.replaceChildren();
  const filtered=articles.filter(item=>(item.article.title+' '+item.article.description).toLowerCase().includes(query));
  $('#count').textContent=filtered.length+' 篇';
  for(const item of filtered){const button=document.createElement('button');button.className='article-link';const title=document.createElement('strong');title.textContent=item.article.title;const description=document.createElement('span');description.textContent=item.article.description||item.article.date.slice(0,10);button.append(title,description);button.addEventListener('click',()=>openArticle(item));list.append(button);}
}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();const token=$('#access-token').value.trim();if(!token)return;
  $('#login-button').disabled=true;setMessage('正在核对阅读权限…');
  controller?.abort();controller=new AbortController();const current=++session;
  try{
    const response=await fetch('./config.json',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('阅读空间配置暂时无法加载。');const config=await response.json();
    client=createGitHubReader({...config,token,signal:controller.signal});
    const account=await client.signIn();const files=await client.list();if(current!==session)return;
    $('#account').textContent='@'+account.login+' · 只读';$('#access-token').value='';
    $('#login-panel').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=false;setMessage('正在读取文章…');
    articles=[];let next=0;
    const workers=Array.from({length:Math.min(4,files.length)},async()=>{while(next<files.length){const file=files[next++];const article=await client.article(file);if(current!==session)return;articles.push({file,article});showList();}});
    await Promise.all(workers);if(current!==session)return;
    articles.sort((a,b)=>b.article.date.localeCompare(a.article.date));showList();
    setMessage(articles.length?'已载入 '+articles.length+' 篇文章。':'暂时还没有私密文章。');
    if(articles.length)await openArticle(articles[0]);else $('#article').textContent='这里会显示你获授权阅读的文章。';
  }catch(error){if(current!==session)return;const message=error.name==='AbortError'?'读取已取消。':error.message;signOut();setMessage(message);}
  finally{$('#login-button').disabled=false;}
});
$('#logout').addEventListener('click',signOut);$('#search').addEventListener('input',showList);
window.addEventListener('pagehide',signOut);

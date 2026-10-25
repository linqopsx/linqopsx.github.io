import {load} from './vendor/js-yaml.mjs';
import {marked} from './vendor/marked.mjs';

export function parseArticle(source, fallback='未命名文章') {
  const match=source.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/);
  const metadata=match?(load(match[1])||{}):{};
  return {title:typeof metadata.title==='string'?metadata.title:fallback,date:typeof metadata.date==='string'?metadata.date:'',description:typeof metadata.description==='string'?metadata.description:'',body:match?source.slice(match[0].length):source};
}

export function decodeBase64(value) {
  const bytes=Uint8Array.from(atob(value.replace(/\s/g,'')),c=>c.charCodeAt(0));
  return bytes;
}

export function privateMediaPath(source, folder='media') {
  try {
    if(/^(?:[a-z]+:|\/\/)/i.test(source))return null;
    const path=decodeURIComponent(source).replace(/^\//,'').split(/[?#]/)[0];
    if(!path.startsWith(folder+'/')||path.split('/').some(part=>!part||part==='.'||part==='..'||part.includes('\\')))return null;
    return path;
  } catch {return null;}
}

export function createGitHubReader({repo,branch='main',token,fetchImpl=globalThis.fetch,signal}) {
  if(!/^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/i.test(repo)||repo.split('/').includes('..'))throw new Error('阅读空间配置无效。');
  const prefix='/repos/'+repo;
  async function get(path) {
    if(path!=='/user'&&!path.startsWith(prefix+'/')&&path!==prefix)throw new Error('不允许访问其他数据源。');
    const response=await fetchImpl('https://api.github.com'+path,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},cache:'no-store',redirect:'error',signal});
    if(!response.ok) {
      const messages={401:'令牌未通过 GitHub 校验，请重新登录。',403:'没有读取权限，或令牌仍在等待组织管理员批准。',404:'你的账号尚未获得这个私密空间的阅读权限，或令牌未选择该仓库。',429:'请求较多，请稍后重试。'};
      const error=new Error(messages[response.status]||'暂时无法读取文章，请稍后重试。');error.status=response.status;throw error;
    }
    return response.json();
  }
  async function textFile(file) {
    const blob=await get(prefix+'/git/blobs/'+file.sha);
    if(blob.encoding!=='base64')throw new Error('暂不支持此文件格式。');
    return new TextDecoder().decode(decodeBase64(blob.content));
  }
  return {
    async signIn(){const [user,repository]=await Promise.all([get('/user'),get(prefix)]);if(!repository.private)throw new Error('这个阅读空间的仓库并非私有，已停止加载。');return {login:user.login};},
    async list(){const files=await get(prefix+'/contents/drafts?ref='+encodeURIComponent(branch));if(!Array.isArray(files))throw new Error('草稿目录配置无效。');return files.filter(file=>file.type==='file'&&/\.(?:md|markdown)$/i.test(file.name));},
    async article(file){return parseArticle(await textFile(file),file.name.replace(/\.md$/i,''));},
    async image(path){
      if(privateMediaPath(path)!==path)return null;
      const extension=path.split('.').pop().toLowerCase();
      const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif'};
      if(!types[extension])return null;
      const file=await get(prefix+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(branch));
      const blob=await get(prefix+'/git/blobs/'+file.sha);
      return new Blob([decodeBase64(blob.content)],{type:types[extension]});
    },
    clear(){token='';}
  };
}

export function renderMarkdown(body,{purify,document}) {
  const fragment=purify.sanitize(marked.parse(body),{RETURN_DOM_FRAGMENT:true,USE_PROFILES:{html:true},FORBID_TAGS:['form','input','button','iframe','object','embed','style','link','meta','video','audio'],FORBID_ATTR:['style','srcset'],ALLOW_DATA_ATTR:false,SANITIZE_NAMED_PROPS:true});
  for(const link of fragment.querySelectorAll('a')){link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';}
  for(const image of fragment.querySelectorAll('img')){
    const source=image.getAttribute('src')||'';
    image.removeAttribute('src');
    const path=privateMediaPath(source);
    if(path){image.dataset.privateMedia=path;image.loading='lazy';image.referrerPolicy='no-referrer';}
    else {const placeholder=document.createElement('span');placeholder.className='image-placeholder';placeholder.textContent=image.alt?'[图片：'+image.alt+']':'[外部图片未自动加载]';image.replaceWith(placeholder);}
  }
  return fragment;
}

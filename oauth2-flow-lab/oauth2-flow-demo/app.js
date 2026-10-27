const $ = id => document.getElementById(id);
const state = { steps: [], current: -1, selected: -1, tab: 'body', timer: null };

const descriptions = {
  0: ['Построение запроса авторизации', 'Клиент генерирует code_verifier и code_challenge. Затем браузер перенаправляется на authorization endpoint с client_id, redirect_uri, scope, state и параметрами PKCE.'],
  1: ['Пользователь проходит аутентификацию', 'Пользователь вводит данные на стороне Authorization Server. В этой лаборатории вход только имитируется: никаких настоящих учётных данных серверу не отправляется.'],
  2: ['Authorization Server возвращает code', 'После успешного согласия сервер перенаправляет браузер обратно на redirect_uri и добавляет короткоживущий authorization code и state. Клиент должен сверить state.'],
  3: ['Клиент обменивает code на токены', 'Клиент отправляет authorization code, redirect_uri, client_id и code_verifier на token endpoint. Сервер проверяет PKCE: challenge должен соответствовать verifier.'],
  4: ['Authorization Server выдаёт токены', 'В ответе token endpoint возвращается access_token, token_type, expires_in и scope. В реальной системе токен нужно защищать и хранить безопасно.'],
  5: ['Клиент обращается к защищённому API', 'Клиент вызывает resource endpoint и передаёт access token в заголовке Authorization: Bearer. Токен не следует помещать в URL.'],
  6: ['API возвращает защищённый ресурс', 'Resource Server проверяет токен, его срок действия, issuer, audience и разрешения. В симуляции он возвращает демонстрационный профиль пользователя.']
};

function b64url(bytes) {
  let s = ''; bytes.forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function randomString(len=48) {
  const a = new Uint8Array(len); crypto.getRandomValues(a); return b64url(a);
}
async function challengeFor(verifier, method) {
  if (method === 'plain') return verifier;
  const bytes = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return b64url(new Uint8Array(digest));
}
function safe(v) { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function responseStep(n, title, method, path, summary, request, response, headers, kind='request') {
  return {n,title,method,path,summary,request,response,headers,kind};
}
function buildSteps(data) {
  const authBase = 'https://auth.example.test';
  const apiBase = 'https://api.example.test';
  const authorize = new URL(authBase + '/authorize');
  Object.entries(data.authParams).forEach(([k,v]) => authorize.searchParams.set(k,v));
  const code = 'ac_' + randomString(22);
  const access = 'eyJhbGciOi...' + randomString(16);
  const refresh = 'def456_' + randomString(12);
  const callback = new URL(data.redirectUri);
  callback.searchParams.set('code', code);
  callback.searchParams.set('state', data.state);
  const tokenBody = new URLSearchParams({
    grant_type:'authorization_code', code, redirect_uri:data.redirectUri,
    client_id:data.clientId, code_verifier:data.verifier
  }).toString();
  const profile = {sub:'user-1042',name:data.username,email:data.username,roles:['reader'],issued_by:'https://auth.example.test'};
  return [
    responseStep(0,'Запрос авторизации','GET',authorize.pathname + authorize.search,'Client → Authorization Server',
      `GET ${authorize.pathname + authorize.search} HTTP/1.1\nHost: auth.example.test\nAccept: text/html`,
      `HTTP/1.1 302 Found\nLocation: ${authorize.toString()}\n\nБраузер перенаправляется на страницу авторизации.`,
      {'HTTP method':'GET','Endpoint':authBase+'/authorize','Параметры':data.authParams,'PKCE code_verifier':data.verifier,'PKCE code_challenge':data.challenge},'request'),
    responseStep(1,'Вход пользователя','LOCAL','Локальное действие','Пользователь → Authorization Server',
      `Пользователь: ${data.username}\nДействие: демонстрационная аутентификация\nПароль: [не показывается и не отправляется]`,
      `Симуляция: пользователь успешно вошёл.\nСервер подготовил authorization code.\n\nВ настоящем flow пароль вводится только на доверенной странице провайдера.`,
      {'Действие':'Локальная симуляция','Пользователь':data.username,'Секреты':'Пароль не включён в трассу'},'local'),
    responseStep(2,'Ответ с authorization code','302','/callback?code=…&state=…','Authorization Server → Client',
      `HTTP/1.1 302 Found\nLocation: ${callback.toString()}\nCache-Control: no-store`,
      `GET ${callback.pathname}${callback.search} HTTP/1.1\nHost: ${callback.host}\n\nКлиент извлекает code и проверяет state.`,
      {'Redirect URI':data.redirectUri,'code':code,'state':data.state,'Проверка state':'Успешно'},'response'),
    responseStep(3,'Запрос token endpoint','POST','/token','Client → Authorization Server',
      `POST /token HTTP/1.1\nHost: auth.example.test\nContent-Type: application/x-www-form-urlencoded\nAccept: application/json\n\n${tokenBody}`,
      `Сервер проверяет authorization code, redirect_uri и PKCE code_verifier.`,
      {'HTTP method':'POST','Endpoint':authBase+'/token','Content-Type':'application/x-www-form-urlencoded','Form body':Object.fromEntries(new URLSearchParams(tokenBody)),'Проверка PKCE':data.pkceMethod+' challenge match'},'request'),
    responseStep(4,'Ответ с токенами','200 OK','/token','Authorization Server → Client',
      `HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store\nPragma: no-cache`,
      JSON.stringify({access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope:data.scope},null,2),
      {'HTTP status':200,'token_type':'Bearer','expires_in':3600,'scope':data.scope,'Примечание':'Токены вымышленные, доступны только в этой демонстрации.'},'response'),
    responseStep(5,'Запрос к Resource Server','GET','/v1/me','Client → Resource Server',
      `GET /v1/me HTTP/1.1\nHost: api.example.test\nAccept: application/json\nAuthorization: Bearer ${access}`,
      `API получает запрос и проверяет bearer token перед доступом к защищённому ресурсу.`,
      {'HTTP method':'GET','Endpoint':apiBase+'/v1/me','Authorization':'Bearer '+access,'Токен в URL':'Нет — используется заголовок'},'request'),
    responseStep(6,'Ответ защищённого API','200 OK','/v1/me','Resource Server → Client',
      `HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store`,
      JSON.stringify(profile,null,2),
      {'HTTP status':200,'Content-Type':'application/json','Проверки':'Подпись/issuer/audience/expiry/scope — концептуально','Результат':'Демонстрационный профиль'},'response')
  ];
}
async function startFlow() {
  stopAuto();
  const clientId = $('clientId').value.trim();
  const redirectUri = $('redirectUri').value.trim();
  const scope = $('scope').value.trim();
  const username = $('username').value.trim() || 'demo-user';
  if (!clientId || !redirectUri) { alert('Заполните Client ID и Redirect URI.'); return; }
  let parsed;
  try { parsed = new URL(redirectUri); if (!['http:','https:'].includes(parsed.protocol)) throw new Error(); }
  catch { alert('Redirect URI должен быть корректным URL с http или https.'); return; }
  const verifier = randomString(48);
  const challenge = await challengeFor(verifier, $('pkceMethod').value);
  const flowState = randomString(18);
  const data = {clientId,redirectUri,scope,username,verifier,challenge,state:flowState,pkceMethod:$('pkceMethod').value,
    authParams:{response_type:$('responseType').value,client_id:clientId,redirect_uri:redirectUri,scope:scope,state:flowState,code_challenge:challenge,code_challenge_method:$('pkceMethod').value}};
  state.steps = buildSteps(data); state.current = -1; state.selected = -1;
  renderList(); updateProgress(); $('nextBtn').disabled = false;
  $('statusText').textContent = 'Flow подготовлен';
  $('explainTitle').textContent = 'Flow подготовлен к запуску';
  $('explainText').textContent = 'Параметры проверены, code_verifier и code_challenge сгенерированы. Нажмите «Следующий шаг», чтобы начать просмотр трассы.';
  $('conceptTags').innerHTML = '<span>state: '+safe(flowState.slice(0,10))+'…</span><span>PKCE: '+safe(data.pkceMethod)+'</span><span>scope: '+safe(scope || '(пусто)')+'</span>';
  $('mapMessage').innerHTML = '<span class="message-number">READY</span><span class="message-label">Параметры подготовлены — переходите к шагу 1</span><span class="message-arrow">→</span>';
  document.querySelectorAll('.actor').forEach(a=>a.classList.remove('active'));
  $('messageDetail').innerHTML = '<div class="detail-placeholder"><div class="empty-icon">⌘</div><strong>Содержимое сообщения</strong><p>Выберите шаг слева, чтобы изучить запрос или ответ.</p></div>';
}
function renderList() {
  const list = $('traceList');
  if (!state.steps.length) return;
  list.innerHTML = state.steps.map((s,i)=>`<button class="trace-item ${i===state.selected?'selected':''}" data-index="${i}">
    <span class="trace-num">${String(i+1).padStart(2,'0')}</span><span class="trace-meta"><strong>${safe(s.title)}</strong><small><span class="method ${s.kind==='response'?'response':s.kind==='local'?'local':''}">${safe(s.method)}</span>${safe(s.path)}</small></span></button>`).join('');
  list.querySelectorAll('.trace-item').forEach(btn=>btn.addEventListener('click',()=>selectStep(Number(btn.dataset.index))));
  $('traceCount').textContent = state.steps.length+' шагов';
}
function selectStep(i) {
  state.selected = i;
  const s = state.steps[i];
  renderList();
  $('messageDetail').innerHTML = `<div class="detail-head"><div class="verb">${safe(s.method)} · ${safe(s.title)}</div><div class="route">${safe(s.path)}</div><p>${safe(s.summary)}</p></div>
    <div class="tabs"><button class="tab ${state.tab==='body'?'active':''}" data-tab="body">Сообщение</button><button class="tab ${state.tab==='headers'?'active':''}" data-tab="headers">Поля и параметры</button><button class="tab ${state.tab==='response'?'active':''}" data-tab="response">Результат</button></div>
    <pre class="code-view" id="codeView"></pre>`;
  setTab(state.tab);
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;setTab(state.tab)}));
}
function setTab(tab) {
  const s=state.steps[state.selected]; if(!s) return;
  const view=$('codeView'); if(!view)return;
  let val = tab==='body' ? s.request : tab==='headers' ? JSON.stringify(s.headers,null,2) : s.response;
  view.textContent = val;
}
function updateProgress() {
  const n=state.current+1, total=state.steps.length;
  $('progressBar').style.width=(total?n/total*100:0)+'%';
  $('progressText').textContent=n+' из '+total+' шагов';
  if(n===0)$('statusText').textContent='Ожидание запуска';
  else if(n<total)$('statusText').textContent='Выполняется · шаг '+n;
  else $('statusText').textContent='Flow завершён';
}
function nextStep() {
  if (!state.steps.length) { startFlow().then(()=>{ if(state.steps.length) nextStep(); }); return; }
  if (state.current >= state.steps.length-1) { stopAuto(); return; }
  state.current++; selectStep(state.current); updateProgress();
  const s=state.steps[state.current];
  const client = state.current===0||state.current===3||state.current===5;
  const auth = state.current===1||state.current===2||state.current===4;
  document.querySelectorAll('.actor').forEach(a=>a.classList.remove('active'));
  if(state.current===6)$('actor-api').classList.add('active');
  else if(client)$('actor-client').classList.add('active');
  else if(auth)$('actor-auth').classList.add('active');
  $('mapMessage').innerHTML=`<span class="message-number">${String(state.current+1).padStart(2,'0')}</span><span class="message-label">${safe(s.title)}</span><span class="message-arrow">${s.kind==='response'?'←':s.kind==='local'?'↻':'→'}</span>`;
  $('explainTitle').textContent=descriptions[state.current][0];
  $('explainText').textContent=descriptions[state.current][1];
  $('conceptTags').innerHTML = (state.current===0?['Authorization Request','state','PKCE S256']:state.current===3?['POST /token','code_verifier','Token Exchange']:state.current===5?['Bearer Token','Resource Server','HTTPS']:state.current===6?['Protected Resource','JSON Response','Scope']:['Redirect','Authorization Code','Browser']).map(t=>'<span>'+safe(t)+'</span>').join('');
  $('nextBtn').textContent=state.current===state.steps.length-1?'✓ Flow завершён':'Следующий шаг →';
}
function stopAuto(){if(state.timer){clearInterval(state.timer);state.timer=null;} $('autoBtn').textContent='▶▶ Проиграть весь flow';}
function autoPlay(){
  if(!state.steps.length){startFlow().then(()=>{if(state.steps.length)autoPlay();});return;}
  if(state.timer){stopAuto();return;}
  if(state.current>=state.steps.length-1)state.current=-1;
  $('autoBtn').textContent='Ⅱ Пауза';
  state.timer=setInterval(()=>{if(state.current>=state.steps.length-1){stopAuto();return;}nextStep();},1450);
}
$('startBtn').addEventListener('click',startFlow);
$('nextBtn').addEventListener('click',nextStep);
$('autoBtn').addEventListener('click',autoPlay);
$('resetBtn').addEventListener('click',()=>{
  stopAuto();state.steps=[];state.current=-1;state.selected=-1;state.tab='body';
  $('traceList').innerHTML='<div class="empty-state"><div class="empty-icon">⇄</div><strong>Трасса пока пуста</strong><p>Нажмите «Запустить flow», затем переходите по шагам.</p></div>';
  $('messageDetail').innerHTML='<div class="detail-placeholder"><div class="empty-icon">⌘</div><strong>Содержимое сообщения</strong><p>Выберите шаг слева, чтобы изучить запрос или ответ.</p></div>';
  $('traceCount').textContent='0 сообщений';$('nextBtn').disabled=true;$('nextBtn').textContent='Следующий шаг →';
  $('statusText').textContent='Ожидание запуска';$('progressBar').style.width='0%';$('progressText').textContent='0 из 7 шагов';
  $('mapMessage').innerHTML='<span class="message-number">—</span><span class="message-label">Запустите flow, чтобы увидеть обмен</span><span class="message-arrow">→</span>';
  $('explainTitle').textContent='Готовы начать?';$('explainText').textContent='Flow состоит из перенаправления пользователя на сервер авторизации, возврата authorization code, обмена code на токены и обращения к API с access token.';
  $('conceptTags').innerHTML='<span>Authorization Code</span><span>PKCE</span><span>Access Token</span>';
  document.querySelectorAll('.actor').forEach(a=>a.classList.remove('active'));
});

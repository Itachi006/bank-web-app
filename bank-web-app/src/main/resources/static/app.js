const $ = (s) => document.querySelector(s);
let token = sessionStorage.getItem('bankToken');
const money = (n) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n||0));
async function api(path, options={}) {
  const headers={'Content-Type':'application/json',...(options.headers||{})};
  if(token) headers.Authorization=`Bearer ${token}`;
  const response=await fetch(`/api${path}`,{...options,headers});
  const data= response.status===204 ? null : await response.json().catch(()=>({error:'Unexpected server response.'}));
  if(!response.ok){if(response.status===401){token=null;sessionStorage.removeItem('bankToken');showAuth();}throw new Error(data?.error||'Request failed.');}
  return data;
}
function showAuth(){ $('#authView').classList.remove('hidden');$('#dashboard').classList.add('hidden'); }
function showDashboard(){ $('#authView').classList.add('hidden');$('#dashboard').classList.remove('hidden');loadDashboard(); }
function message(el,text,ok=false){el.textContent=text;el.classList.toggle('success',ok);}
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===tab));$('#loginForm').classList.toggle('hidden',tab.dataset.tab!=='login');$('#registerForm').classList.toggle('hidden',tab.dataset.tab!=='register');message($('#authMessage'),'');}));
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const r=await api('/login',{method:'POST',body:JSON.stringify({accountId:Number(f.get('accountId')),pin:f.get('pin')})});token=r.token;sessionStorage.setItem('bankToken',token);message($('#authMessage'),'');showDashboard();}catch(err){message($('#authMessage'),err.message);}});
$('#registerForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{const r=await api('/accounts',{method:'POST',body:JSON.stringify({holderName:f.get('holderName'),pin:f.get('pin'),initialDeposit:f.get('initialDeposit')?Number(f.get('initialDeposit')):0})});form.reset();document.querySelector('[data-tab="login"]').click();$('#loginForm [name="accountId"]').value=r.accountId;message($('#authMessage'),`Account created! Your account number is ${r.accountId}. Sign in with your PIN.`,true);}catch(err){message($('#authMessage'),err.message);}});
async function loadDashboard(){try{const [me,tx]=await Promise.all([api('/me'),api('/me/transactions')]);$('#holderName').textContent=me.holderName;$('#balance').textContent=money(me.balance);$('#accountId').textContent=me.accountId;renderTransactions(tx);}catch(err){message($('#dashMessage'),err.message);}}
function renderTransactions(items){const root=$('#transactions');root.replaceChildren();if(!items.length){const p=document.createElement('p');p.className='empty';p.textContent='No transactions yet. Your activity will appear here.';root.append(p);return;}for(const item of items){const row=document.createElement('div');row.className='transaction';const left=document.createElement('div');left.className='tx-left';const icon=document.createElement('div');icon.className='tx-icon '+(['WITHDRAWAL','TRANSFER_OUT'].includes(item.type)?'out':'');icon.textContent=['WITHDRAWAL','TRANSFER_OUT'].includes(item.type)?'↑':'↓';const info=document.createElement('div');const title=document.createElement('div');title.className='tx-title';title.textContent=(item.description||item.type).replaceAll('_',' ');const date=document.createElement('div');date.className='tx-date';date.textContent=item.createdAt?new Date(item.createdAt).toLocaleString('en-IN'):'Recently';info.append(title,date);left.append(icon,info);const amount=document.createElement('div');const incoming=['DEPOSIT','OPENING_DEPOSIT','TRANSFER_IN'].includes(item.type);amount.className='tx-amount '+(incoming?'positive':'');amount.textContent=(incoming?'+':'−')+money(item.amount);row.append(left,amount);root.append(row);}}
async function submitAction(formId,path,makeBody){$(formId).addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{const r=await api(path,{method:'POST',body:JSON.stringify(makeBody(f))});message($('#dashMessage'),r.message||'Transaction completed.',true);form.reset();await loadDashboard();}catch(err){message($('#dashMessage'),err.message);}});}
submitAction('#depositForm','/me/deposit',f=>({amount:Number(f.get('amount'))}));
submitAction('#withdrawForm','/me/withdraw',f=>({amount:Number(f.get('amount'))}));
submitAction('#transferForm','/me/transfer',f=>({toAccountId:Number(f.get('toAccountId')),amount:Number(f.get('amount'))}));
$('#logoutBtn').addEventListener('click',async()=>{try{await api('/logout',{method:'POST'});}catch{}token=null;sessionStorage.removeItem('bankToken');showAuth();});
if(token)showDashboard();else showAuth();

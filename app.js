const menu=document.querySelector('.menu-toggle'),nav=document.getElementById('site-navigation');menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'Close':'Menu';nav.classList.toggle('is-open',open)});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){menu.click();menu.focus()}});
const steps=[['A good first<br>impression.','Help people see why you’re the right fit.'],['An easy way<br>to say hello.','Make reaching out feel simple.'],['A useful<br>next step.','Give the conversation somewhere to go.']];const panels=['sample','message','result'];document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{const i=Number(button.dataset.step);document.querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));panels.forEach((id,j)=>document.getElementById(id).hidden=i!==j);document.getElementById('demo-title').innerHTML=steps[i][0];document.getElementById('demo-caption').textContent=steps[i][1]}));
let brief='';const form=document.getElementById('brief-form');if(form){const selected=new URLSearchParams(location.search).get('service');if(selected==='voice')document.getElementById('need').selectedIndex=1;form.addEventListener('submit',async event=>{
  event.preventDefault();
  const status=document.getElementById('form-status');
  const submit=form.querySelector('[type=submit]');
  const name=document.getElementById('name').value.trim();
  const email=document.getElementById('email').value.trim();
  const goal=document.getElementById('goal').value.trim();
  const need=document.getElementById('need').value;
  const timing=document.getElementById('timing').value;
  const show=function(kind,before,address){
    status.hidden=false;
    status.className=kind==='error'?'fine error':'fine';
    status.replaceChildren();
    if(!address){status.textContent=before;return;}
    const link=document.createElement('a');
    link.href='mailto:'+address;
    link.textContent=address;
    status.append(before,link,'.');
  };
  brief='Made by Lumi — Project starting point\n\nName: '+name+'\nEmail: '+email+'\n\nI’m thinking about: '+need+'\n\nWhat I’d like to improve:\n'+goal+'\n\nTiming: '+timing+'\n\nTo discuss: scope, timing, cost and support.';
  document.getElementById('draft-text').textContent=brief;
  document.getElementById('draft').hidden=false;
  submit.disabled=true;
  show('ok','Sending…');
  try{
    const res=await fetch('/api/inquiry',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({name,email,message:goal,need,timing,hp_field:document.getElementById('hp_field').value})});
    const data=await res.json().catch(function(){return {};});
    if(res.ok&&data.ok)show('ok','Sent to chris@madebylumi.com.');
    else if(res.status===429)show('error','Please wait a moment and try again, or email ','chris@madebylumi.com');
    else show('error','That didn\u2019t send. Email ','chris@madebylumi.com');
  }catch(err){
    show('error','That didn\u2019t send. Email ','chris@madebylumi.com');
  }finally{
    submit.disabled=false;
  }
});document.getElementById('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([brief],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Made-by-Lumi-project-brief.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)})}
const next=document.getElementById('call-next');if(next){let step=0;const back=document.getElementById('call-back'),transcript=document.getElementById('transcript'),email=document.getElementById('email-summary');const conversations=['<p><span>Caller</span>“Hi, I’m interested in a custom website for my shop. Could someone get back to me?”</p><p><span>Lumi Voice · sample</span>“I can take a message for Chris. What would you like the website to help your customers do?”</p>','<p><span>Caller</span>“I’m Sam. I’d like people to see our work and ask about it. I’d love to talk about what’s involved.”</p><p><span>Lumi Voice · sample</span>“Thank you, Sam. I’ll include that in the message for Chris so he knows what you’d like to discuss.”</p>'];function render(){transcript.hidden=step===2;email.hidden=step!==2;if(step<2)transcript.innerHTML=conversations[step];document.getElementById('call-progress').textContent=(step+1)+' of 3';back.disabled=step===0;next.textContent=step===2?'Replay the sample':step===1?'See the email summary':'Continue the sample'}next.addEventListener('click',()=>{step=(step+1)%3;render()});back.addEventListener('click',()=>{step=Math.max(0,step-1);render()})}
document.querySelectorAll('[data-preview]').forEach(button=>button.addEventListener('click',()=>{const gallery=button.dataset.preview==='gallery';document.querySelectorAll('[data-preview]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.getElementById('floral-image').src=gallery?'assets/ivy-gallery.jpg':'assets/ivy-home.jpg';document.getElementById('floral-image').alt=gallery?'Public Ivy & Rose floral gallery showing arrangements':'Public Ivy & Rose Floral Co. website homepage with floral arrangements';document.getElementById('floral-caption').textContent=gallery?'Public client website / Floral gallery':'Public client website / Homepage'}));
const invoice=document.getElementById('invoice-demo');invoice?.addEventListener('submit',event=>{event.preventDefault();const quantity=Number(document.getElementById('invoice-quantity').value),rate=Number(document.getElementById('invoice-rate').value);const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});document.getElementById('invoice-item').textContent=document.getElementById('invoice-description').value.trim()||'Your project';document.getElementById('invoice-detail').textContent=quantity+' × '+money.format(rate);document.getElementById('invoice-total').textContent=money.format(quantity*rate)});
if(form&&new URLSearchParams(location.search).get('service')==='tool')document.getElementById('need').selectedIndex=2;

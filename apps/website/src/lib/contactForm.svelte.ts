import { tick } from 'svelte';
import { z } from 'zod';
import { ContactRequestError, submitContact } from './contactRequest';

const schema = z.object({
  name: z.string().trim().min(1, 'Indique o seu nome.').max(120, 'Use até 120 caracteres.').refine(v => !/[\r\n]/.test(v), 'Indique o nome numa só linha.'),
  email: z.string().trim().email('Indique um email válido, como nome@exemplo.pt.').max(254, 'Use até 254 caracteres.'),
  subject: z.string().trim().min(1, 'Escolha um assunto.').max(120).refine(v => !/[\r\n]/.test(v)),
  message: z.string().trim().min(1, 'Escreva uma mensagem para o stand.').max(5000, 'Use até 5000 caracteres.'),
});
const labels: Record<string,string> = {name:'Nome',email:'Email',subject:'Assunto',message:'Mensagem'};
export type ContactState = { phase: 'idle'|'sending'|'success'|'error'; error: string; kind: string; issues: {field:string;label:string;message:string}[] };
let nextForm = 0;

export function createContactForm() {
  const state = $state<ContactState>({phase:'idle',error:'',kind:'',issues:[]});
  let form: HTMLFormElement | undefined;
  const errors = new Map<string, {node:HTMLElement; field:HTMLElement; described:string|null}>();
  function clear(field?: string) {
    for (const [key,error] of errors) if (!field || key===field) {
      error.node.remove();error.field.removeAttribute('aria-invalid');
      if (error.described) error.field.setAttribute('aria-describedby',error.described);else error.field.removeAttribute('aria-describedby');
      errors.delete(key);
    }
    state.issues = field ? state.issues.filter(issue=>issue.field!==field) : [];
  }
  function focus(field:string) { (form?.elements.namedItem(field) as HTMLElement|null)?.focus(); }
  function focusFeedback(element:HTMLFormElement) {
    const panel=element.querySelector<HTMLElement>('[data-contact-feedback]');
    panel?.focus({preventScroll:true});panel?.scrollIntoView({block:'center',behavior:'instant'});
  }
  function reset() {form?.reset();clear();state.phase='idle';state.error='';state.kind='';}
  function enhance(element: HTMLFormElement) {
    form=element;const originalValidation=element.noValidate;element.noValidate=true;element.classList.add('public-contact-form');
    const prefix=`contact-errors-${++nextForm}`;
    const changed=(event:Event)=>{const field=event.target as HTMLInputElement; if(field.name)clear(field.name);};
    const submit=async(event:SubmitEvent)=>{
      event.preventDefault();if(state.phase==='sending'||state.phase==='success'||state.kind==='conflict')return;
      clear();state.error='';state.kind='';
      const data=new FormData(element),parsed=schema.safeParse(Object.fromEntries(['name','email','subject','message'].map(key=>[key,String(data.get(key)??'')])));
      if(!parsed.success){
        state.phase='error';state.error='Reveja os campos indicados. O pedido ainda não foi enviado.';
        state.issues=parsed.error.issues.map(issue=>({field:String(issue.path[0]),label:labels[String(issue.path[0])]??'Campo',message:issue.message}));
        for(const issue of state.issues){
          const field=element.elements.namedItem(issue.field) as HTMLElement|null;if(!field||errors.has(issue.field))continue;
          const node=document.createElement('span');node.id=prefix+'-'+issue.field;node.className='contact-field-error';node.textContent=issue.message;
          const described=field.getAttribute('aria-describedby');field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',[described,node.id].filter(Boolean).join(' '));
          (field.closest('label')??field.parentElement)?.append(node);errors.set(issue.field,{node,field,described});
        }
        await tick();focusFeedback(element);return;
      }
      state.phase='sending';
      // Capture the payload before locking controls; the honeypot stays in the request.
      const pending=submitContact(element);
      const controls=[...element.elements].filter((item):item is HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement=>item instanceof HTMLInputElement||item instanceof HTMLTextAreaElement||item instanceof HTMLSelectElement);
      const disabled=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
      try {await pending;state.phase='success';}
      catch(error){state.phase='error';state.kind=error instanceof ContactRequestError?error.kind:'uncertain';state.error=error instanceof ContactRequestError?error.message:'Não foi possível confirmar o envio. Os dados foram mantidos. Tente novamente sem alterar os campos.';}
      finally{controls.forEach((control,index)=>control.disabled=disabled[index]!);await tick();focusFeedback(element);}
    };
    element.addEventListener('submit',submit);element.addEventListener('input',changed);
    return {destroy(){element.removeEventListener('submit',submit);element.removeEventListener('input',changed);clear();element.classList.remove('public-contact-form');element.noValidate=originalValidation;if(form===element)form=undefined;}};
  }
  return {state,enhance,focus,reset};
}

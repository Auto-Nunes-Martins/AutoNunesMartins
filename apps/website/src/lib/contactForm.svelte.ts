import { tick } from 'svelte';
import { z } from 'zod';
import { ContactRequestError, submitContact } from './contactRequest';

const schema = z.object({
  name: z.string().trim().min(1, 'Indique o seu nome.').max(120, 'Até 120 caracteres.').refine(v => !/[\r\n]/.test(v), 'Use uma só linha.'),
  email: z.string().trim().email('Indique um email válido.').max(254, 'Até 254 caracteres.'),
  subject: z.string().trim().min(1, 'Escolha um assunto.').max(120, 'Até 120 caracteres.').refine(v => !/[\r\n]/.test(v), 'Escolha um assunto válido.'),
  message: z.string().trim().min(1, 'Escreva uma mensagem.').max(5000, 'Até 5000 caracteres.'),
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
      error.node.textContent='';error.field.removeAttribute('aria-invalid');
      if (error.described) error.field.setAttribute('aria-describedby',error.described);else error.field.removeAttribute('aria-describedby');
    }
    state.issues = field ? state.issues.filter(issue=>issue.field!==field) : [];
  }
  function focus(field:string) { (form?.elements.namedItem(field) as HTMLElement|null)?.focus(); }
  function reset() {form?.reset();clear();state.phase='idle';state.error='';state.kind='';}
  function enhance(element: HTMLFormElement) {
    form=element;const originalValidation=element.noValidate;element.noValidate=true;element.classList.add('public-contact-form');
    const prefix=`contact-errors-${++nextForm}`;
    // Reuse each label's existing inter-field gap. Slots are present from mount,
    // absolutely positioned and one line high, so validation never adds rows.
    for (const key of ['name','email','subject','message']) {
      const field=element.elements.namedItem(key) as HTMLElement|null;
      const label=field?.closest('label');
      if(!field||!label)continue;
      label.classList.add('contact-field-shell');
      const node=document.createElement('span');node.id=prefix+'-'+key;node.className='contact-field-error';
      // Exclude the visual copy from the label name; aria-describedby explicitly
      // references its text when invalid, including for assistive technology.
      node.setAttribute('aria-hidden','true');label.append(node);
      errors.set(key,{node,field,described:field.getAttribute('aria-describedby')});
    }
    const changed=(event:Event)=>{const field=event.target as HTMLInputElement; if(field.name)clear(field.name);if(state.phase==='success'){state.phase='idle';state.error='';state.kind='';}};
    const submit=async(event:SubmitEvent)=>{
      event.preventDefault();if(state.phase==='sending'||state.kind==='conflict')return;
      clear();state.error='';state.kind='';
      const data=new FormData(element),parsed=schema.safeParse(Object.fromEntries(['name','email','subject','message'].map(key=>[key,String(data.get(key)??'')])));
      if(!parsed.success){
        state.phase='error';state.kind='validation-local';state.error='Reveja os campos indicados. O pedido ainda não foi enviado.';
        state.issues=parsed.error.issues.map(issue=>({field:String(issue.path[0]),label:labels[String(issue.path[0])]??'Campo',message:issue.message}));
        for(const issue of state.issues){
          const slot=errors.get(issue.field);if(!slot||slot.field.hasAttribute('aria-invalid'))continue;
          slot.node.textContent=issue.message;slot.field.setAttribute('aria-invalid','true');slot.field.setAttribute('aria-describedby',[slot.described,slot.node.id].filter(Boolean).join(' '));
        }
        await tick();if(state.issues[0])focus(state.issues[0].field);return;
      }
      state.phase='sending';
      // Capture the payload before locking controls; the honeypot stays in the request.
      const pending=submitContact(element);
      const focused = document.activeElement;
      const controls=[...element.elements].filter((item):item is HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement=>item instanceof HTMLInputElement||item instanceof HTMLTextAreaElement||item instanceof HTMLSelectElement);
      const disabled=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
      try {await pending;element.reset();clear();state.phase='success';}
      catch(error){state.phase='error';state.kind=error instanceof ContactRequestError?error.kind:'uncertain';state.error=error instanceof ContactRequestError?error.message:'Não foi possível confirmar o envio. Os dados foram mantidos. Tente novamente sem alterar os campos.';}
      finally{controls.forEach((control,index)=>control.disabled=disabled[index]!);await tick();if(document.activeElement===document.body && focused instanceof HTMLElement && element.contains(focused)) focused.focus({preventScroll:true});}
    };
    element.addEventListener('submit',submit);element.addEventListener('input',changed);
    return {destroy(){element.removeEventListener('submit',submit);element.removeEventListener('input',changed);clear();for(const error of errors.values()){error.node.remove();error.field.closest('label')?.classList.remove('contact-field-shell');}errors.clear();element.classList.remove('public-contact-form');element.noValidate=originalValidation;if(form===element)form=undefined;}};
  }
  return {state,enhance,focus,reset};
}

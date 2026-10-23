<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import {
    descriptionHtml,
    encodeDescription,
    safeDescriptionHref,
  } from '@anm/types/richDescription';
  import {
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    Undo2,
    Redo2,
    Link2,
    Unlink,
    Eraser,
    Heading3,
    IndentIncrease,
    IndentDecrease,
  } from 'lucide-svelte';

  let {
    value = $bindable(''),
    disabled = false,
    required = false,
    maxlength = 6000,
  }: {
    value?: string;
    disabled?: boolean;
    required?: boolean;
    maxlength?: number;
  } = $props();
  const id = $props.id();
  let host: HTMLDivElement;
  let field: HTMLTextAreaElement;
  let linkInput = $state<HTMLInputElement>();
  let editor = $state.raw<Editor | null>(null);
  let revision = $state(0);
  let linkOpen = $state(false),
    href = $state(''),
    linkError = $state(''),
    loadError = $state(false);
  let lastValue = '';
  const tooLong = $derived(value.length > maxlength);

  function active(name: string) {
    revision;
    return editor?.isActive(name) ?? false;
  }
  function canUndo() {
    revision;
    return editor?.can().undo() ?? false;
  }
  function canRedo() {
    revision;
    return editor?.can().redo() ?? false;
  }
  function canIndent(out = false) {
    revision;
    return out ? editor?.can().liftListItem('listItem') : editor?.can().sinkListItem('listItem');
  }

  async function changed(current: Editor) {
    lastValue = current.isEmpty ? '' : encodeDescription(current.getHTML());
    value = lastValue;
    await tick();
    field?.dispatchEvent(new Event('input', { bubbles: true }));
  }
  $effect(() => {
    const current = editor;
    if (current) {
      current.setEditable(!disabled);
      if (value !== lastValue) {
        lastValue = value;
        current.commands.setContent(descriptionHtml(value), { emitUpdate: false });
      }
    }
  });
  $effect(() => {
    value;
    required;
    field?.setCustomValidity(
      tooLong
        ? `A descrição formatada excede o limite de ${maxlength} caracteres. Reduza o texto ou a formatação.`
        : '',
    );
  });

  onMount(() => {
    let disposed = false;
    let transactionQueued = false;
    void Promise.all([import('@tiptap/core'), import('@tiptap/starter-kit')])
      .then(([{ Editor }, { StarterKit }]) => {
        if (disposed) return;
        lastValue = value;
        editor = new Editor({
          element: host,
          injectCSS: false,
          editable: !disabled,
          extensions: [
            StarterKit.configure({
              heading: { levels: [3] },
              code: false,
              codeBlock: false,
              horizontalRule: false,
              blockquote: false,
              strike: false,
              link: {
                openOnClick: false,
                autolink: false,
                linkOnPaste: false,
                defaultProtocol: 'https',
                isAllowedUri: (url) => !!safeDescriptionHref(url),
              },
            }),
          ],
          content: descriptionHtml(value),
          editorProps: {
            attributes: {
              id: id + '-surface',
              role: 'textbox',
              'aria-label': 'Descrição pública',
              'aria-multiline': 'true',
              'aria-describedby': id + '-help',
              spellcheck: 'true',
              lang: 'pt-PT',
            },
            handleKeyDown: (_, event) => {
              if (
                event.key === 'Tab' &&
                (editor?.isActive('bulletList') || editor?.isActive('orderedList'))
              ) {
                const moved = event.shiftKey
                  ? editor.chain().liftListItem('listItem').run()
                  : editor.chain().sinkListItem('listItem').run();
                if (moved) {
                  event.preventDefault();
                  return true;
                }
              }
              return false;
            },
          },
          onUpdate: ({ editor: current }) => void changed(current),
          // A panel becoming inert can synchronously blur Tiptap during a Svelte
          // render. Update toolbar state after that render, and coalesce events.
          onTransaction: () => {
            if (transactionQueued) return;
            transactionQueued = true;
            queueMicrotask(() => {
              transactionQueued = false;
              if (!disposed) revision++;
            });
          },
        });
      })
      .catch(() => {
        loadError = true;
      });
    return () => {
      disposed = true;
      editor?.destroy();
    };
  });

  function retainSelection(event: PointerEvent) {
    event.preventDefault();
  }
  async function showLink() {
    href = editor?.getAttributes('link').href ?? '';
    linkError = '';
    linkOpen = true;
    await tick();
    linkInput?.focus();
  }
  function applyLink() {
    const target = href.trim();
    const safe = safeDescriptionHref(/^https?:\/\//i.test(target) ? target : `https://${target}`);
    if (!safe) {
      linkError = 'Indique uma ligação http ou https válida.';
      return;
    }
    if (editor?.state.selection.empty && !editor.isActive('link'))
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: safe,
          marks: [{ type: 'link', attrs: { href: safe } }],
        })
        .run();
    else editor?.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
    linkOpen = false;
  }
</script>

<div class="description-editor" class:locked={disabled} class:invalid={tooLong}>
  <label class="editor-label" for={id + '-field'}
    >Descrição pública{#if required}<span style="color:var(--color-red)" aria-hidden="true">
        *</span
      >{/if}</label
  >
  {#if editor}
    <div class="editor-toolbar" role="toolbar" aria-label="Formatar descrição pública">
      <button
        type="button"
        title="Negrito (Ctrl+B)"
        aria-label="Negrito"
        aria-pressed={active('bold')}
        {disabled}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button
      >
      <button
        type="button"
        title="Itálico (Ctrl+I)"
        aria-label="Itálico"
        aria-pressed={active('italic')}
        {disabled}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={16} /></button
      >
      <button
        type="button"
        title="Sublinhado (Ctrl+U)"
        aria-label="Sublinhado"
        aria-pressed={active('underline')}
        {disabled}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().toggleUnderline().run()}
        ><Underline size={16} /></button
      >
      <span class="separator" aria-hidden="true"></span>
      <button
        type="button"
        title="Subtítulo"
        aria-label="Subtítulo"
        aria-pressed={active('heading')}
        {disabled}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        ><Heading3 size={17} /></button
      >
      <button
        type="button"
        title="Lista com marcadores"
        aria-label="Lista com marcadores"
        aria-pressed={active('bulletList')}
        {disabled}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().toggleBulletList().run()}><List size={17} /></button
      >
      <button
        type="button"
        title="Lista numerada"
        aria-label="Lista numerada"
        aria-pressed={active('orderedList')}
        {disabled}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().toggleOrderedList().run()}
        ><ListOrdered size={17} /></button
      >
      <button
        type="button"
        title="Aumentar avanço da lista (Tab)"
        aria-label="Aumentar avanço"
        disabled={disabled || !canIndent()}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().sinkListItem('listItem').run()}
        ><IndentIncrease size={17} /></button
      >
      <button
        type="button"
        title="Diminuir avanço da lista (Shift+Tab)"
        aria-label="Diminuir avanço"
        disabled={disabled || !canIndent(true)}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().liftListItem('listItem').run()}
        ><IndentDecrease size={17} /></button
      >
      <span class="separator" aria-hidden="true"></span>
      <button
        type="button"
        title="Adicionar ou editar ligação"
        aria-label="Adicionar ligação"
        aria-pressed={active('link')}
        {disabled}
        onpointerdown={retainSelection}
        onclick={showLink}><Link2 size={16} /></button
      >
      <button
        type="button"
        title="Remover ligação"
        aria-label="Remover ligação"
        disabled={disabled || !active('link')}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().extendMarkRange('link').unsetLink().run()}
        ><Unlink size={16} /></button
      >
      <button
        type="button"
        title="Limpar formatação da seleção"
        aria-label="Limpar formatação"
        {disabled}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
        ><Eraser size={16} /></button
      >
      <span class="separator" aria-hidden="true"></span>
      <button
        type="button"
        title="Desfazer (Ctrl+Z)"
        aria-label="Desfazer"
        disabled={disabled || !canUndo()}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().undo().run()}><Undo2 size={16} /></button
      >
      <button
        type="button"
        title="Refazer (Ctrl+Shift+Z)"
        aria-label="Refazer"
        disabled={disabled || !canRedo()}
        onpointerdown={retainSelection}
        onclick={() => editor?.chain().focus().redo().run()}><Redo2 size={16} /></button
      >
    </div>
  {/if}
  {#if linkOpen}
    <div class="link-editor" role="group" aria-label="Editar ligação">
      <label for={id + '-link'}>Endereço da ligação</label>
      <input
        id={id + '-link'}
        type="url"
        bind:this={linkInput}
        bind:value={href}
        placeholder="https://exemplo.pt"
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            applyLink();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            linkOpen = false;
            editor?.commands.focus();
          }
        }}
      />
      <button type="button" onclick={applyLink}>Aplicar</button>
      <button
        type="button"
        onclick={() => {
          linkOpen = false;
          editor?.commands.focus();
        }}>Cancelar</button
      >
      {#if linkError}<p role="alert">{linkError}</p>{/if}
    </div>
  {/if}
  <div class="editor-host" class:mounted={!!editor} bind:this={host}></div>
  <textarea
    id={id + '-field'}
    name="publicDescription"
    bind:this={field}
    bind:value
    {required}
    {disabled}
    {maxlength}
    class:storage={!!editor}
    rows="9"
    onfocus={() => editor?.commands.focus()}
    oninvalid={(event) => {
      if (editor) {
        event.preventDefault();
        editor.commands.focus();
      }
    }}
    aria-label={editor ? 'Descrição pública — dados do formulário' : 'Descrição pública'}
    aria-describedby={id + '-help'}
  ></textarea>
  <div class="editor-footer" id={id + '-help'}>
    {#if loadError}<span>Editor indisponível. Pode continuar a escrever no campo de texto.</span
      >{/if}
    <span class:over-limit={tooLong}
      >{value.length.toLocaleString('pt-PT')} / {maxlength.toLocaleString('pt-PT')}</span
    >
  </div>
  {#if tooLong}<p class="editor-error" role="alert">
      A descrição formatada excede o limite. Reduza o texto ou a formatação.
    </p>{/if}
</div>

<style>
  .description-editor {
    position: relative;
    min-width: 0;
    margin-block: 18px;
  }
  .editor-label {
    display: block;
    color: var(--color-text-muted);
    font: 10px/1.5 var(--font-mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .editor-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
    padding: 7px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn) var(--radius-btn) 0 0;
    background: var(--color-bg-2);
  }
  .editor-toolbar button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    min-height: 34px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--color-text-muted);
    padding: 0;
  }
  .editor-toolbar button:hover:not(:disabled) {
    background: var(--color-interaction-hover);
    color: var(--color-text);
  }
  .editor-toolbar button[aria-pressed='true'] {
    color: var(--color-red);
    background: color-mix(in oklab, var(--color-red) 10%, transparent);
  }
  .editor-toolbar button:disabled {
    opacity: 0.3;
  }
  .separator {
    height: 18px;
    width: 1px;
    margin-inline: 4px;
    background: var(--color-border);
  }
  .editor-host:not(.mounted) {
    display: none;
  }
  .editor-host {
    border: 1px solid var(--color-border);
    border-top: 0;
    border-radius: 0 0 var(--radius-btn) var(--radius-btn);
    background: var(--color-bg-0);
    resize: vertical;
    overflow: auto;
    min-height: 240px;
    max-height: 640px;
  }
  .editor-host:focus-within {
    border-color: var(--color-red);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-red) 12%, transparent);
  }
  .editor-host :global(.tiptap) {
    min-height: 238px;
    padding: 14px 16px;
    outline: none;
    font: 14px/1.8 var(--font-sans);
    color: var(--color-text);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .editor-host :global(p) {
    margin: 0 0 0.8em;
  }
  .editor-host :global(p:last-child) {
    margin-bottom: 0;
  }
  .editor-host :global(ul),
  .editor-host :global(ol) {
    padding-left: 1.5em;
    margin-block: 0.8em;
  }
  .editor-host :global(ul) {
    list-style: disc;
  }
  .editor-host :global(ol) {
    list-style: decimal;
  }
  .editor-host :global(h3) {
    font-size: 17px;
    line-height: 1.4;
    font-weight: 600;
    margin-block: 1em 0.5em;
  }
  .editor-host :global(strong) {
    font-weight: 700;
  }
  .editor-host :global(em) {
    font-style: italic;
  }
  .editor-host :global(a) {
    color: var(--color-red);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .storage {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    min-height: 1px !important;
    opacity: 0;
    clip-path: inset(50%);
    overflow: hidden;
    padding: 0 !important;
    border: 0 !important;
  }
  .editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 16px;
    margin-top: 7px;
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.5;
  }
  .editor-footer > span:last-child {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .editor-error,
  .over-limit {
    color: var(--color-red);
    font-size: 12px;
  }
  .link-editor {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 8px;
    padding: 12px;
    background: var(--color-bg-2);
    border-inline: 1px solid var(--color-border);
  }
  .link-editor label {
    width: 100%;
    font-size: 12px;
  }
  .link-editor input {
    flex: 1 1 220px;
  }
  .link-editor button {
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    color: var(--color-text);
    background: var(--color-bg-1);
    font-size: 12px;
    min-height: 44px;
  }
  .link-editor p {
    width: 100%;
    color: var(--color-red);
    font-size: 12px;
  }
  .locked {
    opacity: 0.6;
  }
  @media (max-width: 600px) {
    .editor-toolbar button {
      width: 38px;
      height: 38px;
    }
    .editor-footer {
      flex-direction: column;
      gap: 4px;
    }
  }
</style>

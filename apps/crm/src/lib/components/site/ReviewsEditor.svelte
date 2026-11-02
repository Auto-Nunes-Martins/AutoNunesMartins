<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { Plus, ImagePlus, X, Pencil, Trash2, Check, LoaderCircle } from 'lucide-svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';
  import {
    reviewInitials,
    reviewAvatarUrl,
    reviewInputSchema,
    type PublicReview,
  } from '@anm/types';
  import { sessionFetch } from '$lib/auth/session';
  import { crmPath } from '$lib/paths';
  import { formFeedback, markFormSaved, refreshFormFeedback } from '$lib/forms/formFeedback';

  let { initialItems }: { initialItems: PublicReview[] } = $props();
  let items = $state<PublicReview[]>(untrack(() => [...initialItems]));
  let open = $state(false),
    editingId = $state<string | null>(null),
    name = $state(''),
    text = $state('');
  let rating = $state(5),
    hoverRating = $state(0),
    saving = $state(false),
    deleting = $state(false);
  let message = $state(''),
    error = $state(''),
    confirmDelete = $state<string | null>(null);
  let photo = $state<File | null>(null),
    preview = $state(''),
    removePhoto = $state(false);
  let previewFailed = $state(false);
  let failedImages = $state<string[]>([]);
  let nameInput = $state<HTMLInputElement>();
  let photoInput = $state<HTMLInputElement>();
  let editorForm = $state<HTMLFormElement>();
  const displayedRating = $derived(hoverRating || rating);
  let sparkleVersion = $state(0);
  let sparkleActive = $state(false);
  let sparkleTimer: ReturnType<typeof setTimeout> | undefined;
  function stopSparkle() {
    clearTimeout(sparkleTimer);
    sparkleActive = false;
  }
  function sparkle() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    clearTimeout(sparkleTimer);
    sparkleVersion += 1;
    sparkleActive = true;
    sparkleTimer = setTimeout(() => (sparkleActive = false), 760);
  }
  const starPath =
    'M12 1.5 15.05 8.05 22.25 8.95 16.9 13.85 18.35 21 12 17.35 5.65 21 7.1 13.85 1.75 8.95 8.95 8.05Z';
  const ratingLabel = (value: number) => `${value.toLocaleString('pt-PT')} de 5 estrelas`;
  function pointerRating(event: PointerEvent) {
    const stars = Array.from((event.currentTarget as HTMLElement).querySelectorAll('[data-star]'));
    const index = stars.findIndex((star) => event.clientX <= star.getBoundingClientRect().right);
    if (index < 0) return 5;
    const rect = stars[index]!.getBoundingClientRect();
    return index + (event.clientX < (rect.left + rect.right) / 2 ? 0.5 : 1);
  }
  function chooseRating(event: PointerEvent) {
    if (saving || event.button !== 0) return;
    const before = rating;
    (event.currentTarget as HTMLElement).focus();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    rating = pointerRating(event);
    hoverRating = 0;
    if (rating !== before) sparkle();
  }
  function previewRating(event: PointerEvent) {
    if (saving) return;
    const before = displayedRating;
    if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId))
      rating = pointerRating(event);
    else if (event.pointerType !== 'touch') hoverRating = pointerRating(event);
    if ((hoverRating || rating) !== before) sparkle();
  }
  function ratingKey(event: KeyboardEvent) {
    if (saving) return;
    const step = ['ArrowRight', 'ArrowUp'].includes(event.key)
      ? 0.5
      : ['ArrowLeft', 'ArrowDown'].includes(event.key)
        ? -0.5
        : 0;
    if (!step && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const before = rating;
    hoverRating = 0;
    rating =
      event.key === 'Home'
        ? 0.5
        : event.key === 'End'
          ? 5
          : Math.max(0.5, Math.min(5, rating + step));
    if (rating !== before) sparkle();
  }
  $effect(() => {
    rating;
    removePhoto;
    photo;
    if (editorForm) refreshFormFeedback(editorForm);
  });
  const selected = $derived(items.find((item) => item.id === editingId));
  const previewPhoto = $derived(
    !previewFailed
      ? preview ||
          (!removePhoto && selected ? reviewAvatarUrl(PUBLIC_BACKEND_URL, selected) : undefined)
      : undefined,
  );
  function clearPreview() {
    if (preview) URL.revokeObjectURL(preview);
    preview = '';
    photo = null;
    previewFailed = false;
  }
  onDestroy(() => {
    clearPreview();
    stopSparkle();
  });
  function edit(review?: PublicReview) {
    stopSparkle();
    clearPreview();
    editingId = review?.id ?? null;
    name = review?.authorName ?? '';
    text = review?.text ?? '';
    rating = review?.rating ?? 5;
    hoverRating = 0;
    removePhoto = false;
    error = '';
    message = '';
    open = true;
    requestAnimationFrame(() => nameInput?.focus());
  }
  function choosePhoto(event: Event) {
    const input = event.currentTarget as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      error = 'Escolha uma fotografia até 5 MB.';
      input.value = '';
      return;
    }
    clearPreview();
    photo = file;
    preview = URL.createObjectURL(file);
    removePhoto = false;
    error = '';
    input.value = '';
  }
  async function request(path: string, method: string, body?: BodyInit, type = 'application/json') {
    const response = await sessionFetch(crmPath('/site/reviews/api') + path, {
      method,
      body,
      headers: { 'content-type': type },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? 'Não foi possível guardar. Tente novamente.');
    }
    return response.status === 204 ? null : ((await response.json()) as PublicReview);
  }
  function upsert(review: PublicReview) {
    items = [review, ...items.filter((item) => item.id !== review.id)];
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = reviewInputSchema.safeParse({ authorName: name, rating, text });
    if (!parsed.success) {
      error = 'Preencha o nome, escolha as estrelas e escreva a review (até 5000 caracteres).';
      return;
    }
    saving = true;
    error = '';
    message = '';
    let metadataSaved = false;
    try {
      const review = await request(
        editingId ? '/' + editingId : '',
        editingId ? 'PUT' : 'POST',
        JSON.stringify(parsed.data),
      );
      if (!review) throw new Error('Resposta inválida.');
      editingId = review.id;
      upsert(review);
      metadataSaved = true;
      if (photo) {
        const updated = await request(
          '/' + review.id + '/avatar',
          'PUT',
          photo,
          photo.type || 'application/octet-stream',
        );
        if (updated) upsert(updated);
      } else if (removePhoto && review.avatarVersion) {
        const updated = await request('/' + review.id + '/avatar', 'DELETE');
        if (updated) upsert(updated);
      }
      if (editorForm) markFormSaved(editorForm);
      clearPreview();
      open = false;
      message = 'Review guardada. Já está disponível na secção do site público.';
    } catch (err) {
      error =
        (metadataSaved
          ? 'O nome, as estrelas e o texto foram guardados. Falta guardar a fotografia: '
          : '') + (err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      saving = false;
    }
  }
  async function remove(id: string) {
    if (deleting) return;
    deleting = true;
    error = '';
    message = '';
    try {
      await request('/' + id, 'DELETE');
      items = items.filter((item) => item.id !== id);
      confirmDelete = null;
      message = 'Review removida do site público.';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Não foi possível remover.';
    } finally {
      deleting = false;
    }
  }
</script>

<div class="reviews-manager">
  <div class="intro">
    <div>
      <h2>Vozes que dão confiança.</h2>
      <p>
        Escolha as reviews Google que quer partilhar. Copie o texto, acrescente o autor e dê-lhe
        lugar na montra.
      </p>
    </div>
    <button class="add primary" disabled={open || saving} onclick={() => edit()}
      ><Plus size={17} /> Adicionar review</button
    >
  </div>
  <p class="source-note">
    Gestão manual pelo stand. Sem importação automática nem verificação pelo Google.
  </p>
  {#if message}<p class="notice success" role="status"><Check size={16} />{message}</p>{/if}
  {#if error}<p class="notice failure" role="alert">{error}</p>{/if}

  {#if open}
    <form
      class="editor"
      bind:this={editorForm}
      use:formFeedback
      onsubmit={save}
      aria-label={editingId ? 'Editar review' : 'Adicionar review'}
    >
      <div class="editor-heading">
        <div>
          <span class="eyebrow">{editingId ? 'EDITAR REVIEW' : 'NOVA REVIEW'}</span>
          <h3>Uma boa experiência merece ser contada.</h3>
        </div>
        <button
          type="button"
          class="icon"
          aria-label="Cancelar edição"
          disabled={saving}
          onclick={() => {
            clearPreview();
            open = false;
            error = '';
          }}><X size={19} /></button
        >
      </div>
      <fieldset data-save-lock disabled={saving}>
        <input type="hidden" name="rating" value={rating} />
        <input type="hidden" name="photoChanged" value={photo ? 'true' : 'false'} />
        <input type="hidden" name="removePhoto" value={removePhoto ? 'true' : 'false'} />
        <div class="edit-card">
          <div class="card-top">
            <div class="avatar-editor">
              <button
                type="button"
                class="avatar-upload"
                aria-label={previewPhoto || photo
                  ? 'Alterar fotografia do autor'
                  : 'Adicionar fotografia do autor'}
                aria-describedby="review-photo-help"
                onclick={() => photoInput?.click()}
              >
                <span class="avatar large"
                  >{#if previewPhoto}<img
                      src={previewPhoto}
                      alt="Pré-visualização da fotografia do autor"
                      onerror={() => (previewFailed = true)}
                    />{:else}{reviewInitials(name) || '?'}{/if}</span
                >
                <span class="camera-badge" aria-hidden="true"><ImagePlus size={12} /></span>
              </button>
              <input
                class="photo-input"
                bind:this={photoInput}
                type="file"
                tabindex="-1"
                aria-label="Fotografia do autor"
                accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
                onchange={choosePhoto}
              />
              {#if previewPhoto || photo || (selected?.avatarVersion && !removePhoto)}<button
                  type="button"
                  class="photo-remove"
                  aria-label="Usar iniciais"
                  title="Remover fotografia e usar iniciais"
                  onclick={() => {
                    clearPreview();
                    removePhoto = true;
                  }}><X size={12} /></button
                >{/if}
            </div>
            <div class="author">
              <label class="sr-only" for="review-name">Nome público do autor</label><input
                data-inline-edit
                name="authorName"
                id="review-name"
                bind:this={nameInput}
                bind:value={name}
                maxlength="100"
                placeholder="Nome do cliente"
                required
                autocomplete="off"
              /><small class="client-label">Opinião de cliente</small>
            </div>
            <div class="rating">
              <div
                class="rating-track"
                role="slider"
                aria-disabled={saving}
                tabindex={saving ? -1 : 0}
                aria-label="Avaliação em estrelas"
                aria-valuemin="0.5"
                aria-valuemax="5"
                aria-valuenow={rating}
                aria-valuetext={ratingLabel(rating)}
                aria-describedby="review-rating-help"
                onkeydown={ratingKey}
                onpointerdown={chooseRating}
                onpointermove={previewRating}
                onpointerup={(event) => {
                  (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
                  hoverRating = 0;
                }}
                onpointercancel={() => {
                  hoverRating = 0;
                  stopSparkle();
                }}
                onpointerleave={() => {
                  hoverRating = 0;
                  stopSparkle();
                }}
                onblur={stopSparkle}
              >
                {#each [1, 2, 3, 4, 5] as value}
                  <span class="rating-star" data-star={value} aria-hidden="true"
                    ><span class="star-icon"
                      ><svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.1"
                        stroke-linejoin="miter"><path d={starPath} /></svg
                      ><span
                        class="star-fill"
                        style:width={`${Math.max(0, Math.min(1, (hoverRating || rating) - value + 1)) * 100}%`}
                        ><svg viewBox="0 0 24 24" fill="currentColor"><path d={starPath} /></svg
                        ></span
                      >
                      {#if sparkleActive && value === Math.ceil(displayedRating)}
                        {#key sparkleVersion}
                          <span class="star-sparks" aria-hidden="true">
                            {#each ['one', 'two', 'three'] as spark}
                              <svg class={`spark-${spark}`} viewBox="0 0 12 12" fill="currentColor"
                                ><path
                                  d="M6 0 7.4 4.6 12 6 7.4 7.4 6 12 4.6 7.4 0 6 4.6 4.6Z"
                                /></svg
                              >
                            {/each}
                          </span>
                        {/key}
                      {/if}</span
                    ></span
                  >
                {/each}
              </div>
              <span class="rating-value" aria-live="polite"
                >{(hoverRating || rating).toLocaleString('pt-PT')} de 5</span
              >
            </div>
          </div>
          <label class="sr-only" for="review-text">Texto da review</label>
          <textarea
            data-inline-edit
            name="text"
            id="review-text"
            bind:value={text}
            maxlength="5000"
            rows="5"
            placeholder="Cole aqui o texto da review…"
            required
          ></textarea>
          <div class="card-bottom">
            <span>Seleção do stand</span><span>{text.length}/5000</span>
          </div>
        </div>
        <p id="review-rating-help" class="editor-help">
          Edite o nome e o texto no cartão. Nas estrelas, escolha a metade pretendida ou use as
          setas do teclado, em passos de 0,5.
        </p>
        <p id="review-photo-help" class="photo-help">
          Toque no avatar para adicionar uma fotografia opcional (até 5 MB). Sem fotografia, usamos
          as iniciais.
        </p>
      </fieldset>
      <div class="editor-actions">
        <button
          type="button"
          class="quiet"
          disabled={saving}
          onclick={() => {
            clearPreview();
            open = false;
          }}>Cancelar</button
        ><button class="primary" type="submit" disabled={saving}
          >{#if saving}<LoaderCircle size={16} class="spin" />A guardar…{:else}<Check
              size={16}
            />Guardar review{/if}</button
        >
      </div>
    </form>
  {/if}

  {#if !items.length && !open}
    <div class="empty">
      <div class="empty-stars">★★★★★</div>
      <h3>As próximas palavras são dos seus clientes.</h3>
      <p>
        Adicione a primeira review para a mostrar no site. Enquanto não houver reviews, a secção
        «Quem veio, conta» fica oculta.
      </p>
      <button class="primary" onclick={() => edit()}><Plus size={17} />Adicionar review</button>
    </div>
  {:else if items.length}
    <div class="collection-heading">
      <h3>Na montra <span>{items.length}</span></h3>
      <p>As reviews mais recentes aparecem primeiro.</p>
    </div>
    <div class="cards">
      {#each items as review (review.id)}
        <article class="saved-card">
          <div class="card-top">
            <span class="avatar"
              >{#if review.avatarVersion && !failedImages.includes(review.id)}<img
                  src={reviewAvatarUrl(PUBLIC_BACKEND_URL, review)}
                  alt=""
                  onerror={() => (failedImages = [...failedImages, review.id])}
                />{:else}{reviewInitials(review.authorName)}{/if}</span
            >
            <div class="author">
              <h4>{review.authorName}</h4>
              <small>Google · seleção do stand</small>
            </div>
            <span class="saved-stars" aria-label={`${review.rating} de 5 estrelas`}
              >{'★'.repeat(Math.floor(review.rating))}{#if review.rating % 1}<span
                  class="half-star"
                  aria-hidden="true">☆</span
                >{/if}<span class="empty-star">{'☆'.repeat(5 - Math.ceil(review.rating))}</span
              ></span
            >
          </div>
          <p class="review-text">{review.text}</p>
          <div class="saved-actions">
            <button disabled={open || deleting} onclick={() => edit(review)}
              ><Pencil size={14} />Editar</button
            ><button disabled={open || deleting} onclick={() => (confirmDelete = review.id)}
              ><Trash2 size={14} />Remover</button
            >
          </div>
          {#if confirmDelete === review.id}<div class="delete-confirm" role="alert">
              <p>Remover esta review e a fotografia do site?</p>
              <button disabled={deleting} onclick={() => (confirmDelete = null)}>Cancelar</button
              ><button disabled={deleting} onclick={() => remove(review.id)}
                >{deleting ? 'A remover…' : 'Remover review'}</button
              >
            </div>{/if}
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .avatar-editor {
    position: relative;
    flex: 0 0 52px;
    width: 52px;
    height: 52px;
  }
  .avatar-upload {
    position: relative;
    width: 52px;
    height: 52px;
    min-height: 52px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
  }
  .camera-badge {
    position: absolute;
    right: -2px;
    bottom: -2px;
    display: grid;
    place-items: center;
    width: 21px;
    height: 21px;
    border: 2px solid var(--color-bg-0);
    border-radius: 50%;
    background: var(--color-bg-3);
    color: var(--color-text);
  }
  .avatar-upload:hover .camera-badge,
  .avatar-upload:focus-visible .camera-badge {
    background: var(--color-red);
    color: white;
  }
  .photo-remove {
    position: absolute;
    right: -9px;
    top: -9px;
    width: 24px;
    height: 24px;
    min-height: 24px;
    padding: 2px;
    border-radius: 50%;
    background: var(--color-bg-2);
    z-index: 1;
  }
  .photo-input {
    display: none;
  }
  .photo-help {
    font-size: 10px;
    line-height: 1.6;
    color: var(--color-text-muted);
    margin: 12px 0 0;
  }
  .reviews-manager {
    color: var(--color-text);
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    padding: 10px 15px;
    border-radius: var(--radius-btn);
    font-size: 13px;
    cursor: pointer;
    border: 1px solid var(--color-border-strong);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
  .primary {
    background: var(--color-red);
    border-color: var(--color-red);
    color: white;
    font-weight: 600;
  }
  .quiet {
    border-color: transparent;
    color: var(--color-text-muted);
  }
  .icon {
    width: 42px;
    padding: 8px;
  }
  .intro {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
  }
  .intro h2 {
    font-size: 22px;
    letter-spacing: -0.03em;
    margin: 0 0 10px;
  }
  .intro p,
  .source-note {
    color: var(--color-text-muted);
    font-size: 13px;
    line-height: 1.7;
    max-width: 620px;
  }
  .source-note {
    font-size: 11px;
    margin: 12px 0 28px;
  }
  .add {
    white-space: nowrap;
  }
  .notice {
    padding: 14px 16px;
    border: 1px solid var(--color-border);
    display: flex;
    gap: 10px;
    font-size: 13px;
    margin: 16px 0;
    border-radius: 5px;
  }
  .success {
    color: var(--color-success);
  }
  .failure {
    color: var(--color-danger);
  }
  .editor {
    max-width: 880px;
    margin: 24px auto 36px;
    padding: 28px;
    border: 1px solid var(--color-border-strong);
    border-top: 2px solid var(--color-red);
    border-radius: 8px;
    background: var(--color-bg-1);
  }
  .editor-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
  }
  .eyebrow {
    font: 10px var(--font-mono);
    letter-spacing: 0.12em;
    color: var(--color-red);
  }
  .editor-heading h3 {
    font-size: 18px;
    font-weight: 500;
    letter-spacing: -0.025em;
    margin: 8px 0 0;
  }
  fieldset {
    border: 0;
    padding: 0;
    min-width: 0;
  }
  .edit-card {
    padding: 26px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-0);
  }
  .card-top {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 42px;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--color-bg-3);
    font-size: 13px;
    color: var(--color-text);
    overflow: hidden;
  }
  .avatar.large {
    flex-basis: 52px;
    width: 52px;
    height: 52px;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .author {
    min-width: 0;
    flex: 1;
  }
  .author input {
    width: 100%;
    min-width: 0;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--color-border-strong);
    padding: 5px 0;
    font-size: 17px;
    color: var(--color-text);
  }
  .rating {
    position: relative;
    align-self: center;
    color: #b69a61;
  }
  .rating-track {
    display: flex;
    gap: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    padding: 0;
    outline: 0;
    cursor: pointer;
    touch-action: pan-y;
  }
  .rating-star {
    display: grid;
    place-items: center;
    width: 26px;
    height: 44px;
  }
  .star-icon {
    position: relative;
    display: block;
    width: 20px;
    height: 20px;
    color: var(--color-text-faint);
  }
  .star-icon svg {
    display: block;
    width: 20px;
    height: 20px;
  }
  .star-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    overflow: hidden;
    color: #ffda32;
    pointer-events: none;
    filter: drop-shadow(0 0 2px #ffda3233);
  }
  .rating-track:hover .star-fill,
  .rating-track:focus-visible .star-fill {
    color: #ffe765;
  }
  .star-sparks {
    position: absolute;
    inset: 0;
    pointer-events: none;
    color: #fff2a0;
  }
  .star-icon .star-sparks svg {
    position: absolute;
    pointer-events: none;
    opacity: 0;
    animation: star-twinkle 560ms ease-out both;
  }
  .star-icon .star-sparks .spark-one {
    width: 8px;
    height: 8px;
    left: -7px;
    top: -7px;
  }
  .star-icon .star-sparks .spark-two {
    width: 6px;
    height: 6px;
    right: -7px;
    top: 2px;
    animation-delay: 90ms;
  }
  .star-icon .star-sparks .spark-three {
    width: 4px;
    height: 4px;
    left: 4px;
    bottom: -7px;
    animation-delay: 160ms;
  }
  @keyframes star-twinkle {
    0% {
      opacity: 0;
      transform: translateY(3px) scale(0.25);
    }
    25% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    65% {
      opacity: 0.85;
    }
    100% {
      opacity: 0;
      transform: translateY(-4px) scale(0.35);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .star-sparks {
      display: none;
    }
    .star-icon .star-sparks svg {
      animation: none;
    }
  }
  .rating-value {
    position: absolute;
    right: 2px;
    bottom: -7px;
    font-size: 10px;
    line-height: 1;
    color: var(--color-text-muted);
    white-space: nowrap;
  }
  .rating:has(.rating-track:focus-visible) .rating-value {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
  textarea {
    display: block;
    width: 100%;
    resize: vertical;
    min-height: 130px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    line-height: 1.8;
    color: var(--color-text);
    font: inherit;
    font-size: 14px;
  }
  .card-bottom {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 15px;
    font-size: 10px;
    color: var(--color-text-muted);
  }
  .editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
  }
  .empty {
    text-align: center;
    border: 1px dashed var(--color-border-strong);
    border-radius: 8px;
    padding: 64px 24px;
    background: var(--color-bg-1);
  }
  .empty-stars {
    font-size: 28px;
    letter-spacing: 7px;
    color: var(--color-text-faint);
    margin-bottom: 20px;
  }
  .empty h3 {
    font-size: 22px;
    letter-spacing: -0.03em;
    font-weight: 500;
  }
  .empty p {
    max-width: 480px;
    margin: 14px auto 24px;
    font-size: 13px;
    color: var(--color-text-muted);
    line-height: 1.8;
  }
  .collection-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 28px 0 16px;
  }
  .collection-heading h3 {
    font-size: 14px;
    font-weight: 600;
  }
  .collection-heading h3 span {
    margin-left: 6px;
    color: var(--color-text-muted);
  }
  .collection-heading p {
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }
  .saved-card {
    min-width: 0;
    padding: 22px;
    border: 1px solid var(--color-border);
    border-radius: 7px;
    background: var(--color-bg-1);
  }
  .author h4 {
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .author small {
    display: block;
    margin-top: 5px;
    font-size: 10px;
    color: var(--color-text-muted);
  }
  .saved-stars {
    color: #e8b052;
    font-size: 13px;
    white-space: nowrap;
    letter-spacing: 1px;
  }
  .empty-star {
    color: var(--color-text-muted);
  }
  .review-text {
    font-size: 13px;
    color: var(--color-text-muted);
    line-height: 1.8;
    margin: 20px 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .saved-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid var(--color-border);
    padding-top: 12px;
  }
  .saved-actions button {
    min-height: 36px;
    padding: 6px 10px;
    font-size: 11px;
    border: 0;
  }
  .delete-confirm {
    border-top: 1px solid var(--color-border);
    margin-top: 12px;
    padding-top: 12px;
    font-size: 12px;
  }
  .delete-confirm p {
    margin-bottom: 10px;
  }
  .delete-confirm button {
    min-height: 36px;
    padding: 6px 12px;
    margin-right: 8px;
  }
  .reviews-manager :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (max-width: 700px) {
    .intro {
      align-items: start;
      flex-direction: column;
      gap: 16px;
    }
    .add {
      width: 100%;
    }
    .cards {
      grid-template-columns: 1fr;
    }
    .editor {
      padding: 16px;
    }
    .edit-card {
      padding: 16px;
    }
    .editor-heading h3 {
      font-size: 16px;
    }
    .collection-heading {
      align-items: start;
      flex-direction: column;
      gap: 6px;
    }
    .saved-card {
      padding: 18px;
    }
    .saved-stars {
      font-size: 11px;
      letter-spacing: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .reviews-manager :global(.spin) {
      animation: none;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  .editor {
    max-width: 720px;
    padding: 24px 0;
    border: 0;
    border-top: 1px solid var(--color-border-strong);
    border-radius: 0;
    background: transparent;
  }
  .edit-card {
    padding: 28px 26px;
    border-radius: 12px;
    background: var(--color-bg-1);
  }
  .edit-card .card-top {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto;
    gap: 10px;
    margin-bottom: 22px;
  }
  .avatar-editor,
  .avatar-upload,
  .avatar.large {
    width: 44px;
    height: 44px;
  }
  .avatar-upload {
    min-height: 44px;
  }
  .avatar.large {
    flex-basis: 44px;
  }
  .camera-badge {
    border-color: var(--color-bg-1);
  }
  .author input {
    font-size: 16px;
    font-weight: 500;
    letter-spacing: -0.02em;
    padding: 2px 0;
    border-bottom-color: var(--color-border-strong);
  }
  .author input:hover,
  .author input:focus {
    border-bottom-color: var(--color-border-strong);
  }
  .author .client-label {
    display: block;
    margin-top: 5px;
    color: #899e91;
    font-size: 10px;
  }
  textarea {
    padding: 0;
    border: 0;
    border-bottom: 1px solid var(--color-border-strong);
    border-radius: 0;
    color: var(--color-text-muted);
    line-height: 1.8;
  }
  textarea:hover,
  textarea:focus {
    border-bottom-color: var(--color-border-strong);
  }
  .editor-help {
    font-size: 11px;
    line-height: 1.7;
    color: var(--color-text-muted);
    margin: 14px 0 0;
  }
  .photo-help {
    margin-top: 5px;
  }
  .half-star {
    position: relative;
    display: inline-block;
  }
  .half-star::after {
    content: '★';
    position: absolute;
    left: 0;
    top: 0;
    width: 50%;
    overflow: hidden;
  }
  @media (max-width: 700px) {
    .editor {
      padding: 20px 0;
    }
    .edit-card {
      padding: 26px 20px;
    }
    .edit-card .card-top {
      grid-template-columns: 36px minmax(0, 1fr) auto;
      gap: 8px;
    }
    .avatar-editor,
    .avatar-upload,
    .avatar.large {
      width: 36px;
      height: 36px;
    }
    .avatar-upload {
      min-height: 36px;
    }
    .avatar.large {
      flex-basis: 36px;
    }
    .author input {
      font-size: 15px;
    }
    .rating-star {
      width: 22px;
    }
    .star-icon,
    .star-icon svg {
      width: 18px;
      height: 18px;
    }
  }

  .edit-card input:focus,
  .edit-card textarea:focus {
    outline: none;
    box-shadow: none;
    border-bottom-color: var(--color-text-muted);
  }
  .edit-card input,
  .edit-card textarea {
    border-bottom-width: 2px;
  }
  .edit-card textarea {
    max-height: max(130px, min(320px, 40svh));
    overflow-y: auto;
  }
  @media (max-width: 700px) {
    .edit-card textarea {
      max-height: max(130px, min(240px, 35svh));
    }
  }
  .edit-card input:focus-visible,
  .edit-card textarea:focus-visible {
    outline: none;
    box-shadow: none;
    border-bottom-width: 2px;
  }
</style>

# Public website publication reviews

## Public image delivery experiment

For requests about the single-photo experiment or restoring responsive images (including “Desfaz a experiência de foto única”), first read `docs/photo-delivery-experiment.md`. It identifies the isolated image commit, durable remote tags and targeted rollback procedure. Preserve later changes, the WebP84 compression recipe, Storage masters and unrelated CRM fixes. This is operational context, not an additional approval policy.

## Publication readiness

When reviewing publication readiness or answering whether the public website is ready to launch, first read `docs/publication-readiness.md` and `apps/website/src/lib/publicationReadiness.json`. The owner explicitly requested visible placeholders until official information is supplied. Do not treat legal-page existence, passing tests or completed UI work as publication approval. Preserve pending items until confirmed, record the evidence when resolving them, and distinguish legal/data readiness from technical build verification. This is a review checklist, not an additional permission policy.

## Worktree deletion incident safeguards

These rules record the owner's explicit request after two reported deletion incidents. The investigation linked the documented 2026-10-28 source loss to automatic worktree cleanup while a worktree shared the main checkout's node_modules through an NTFS junction. The exact process responsible for each deletion remains unproven. Preserve this incident context for every future deletion or cleanup decision.

- Do not initiate automatic worktree or dependency cleanup. Destructive operations require explicit human authorization for their exact scope; authorization to discard code does not implicitly authorize deleting secrets or local configuration.
- Before any removal, present an inventory of absolute paths, validate every ancestor and reparse point, and resolve link destinations. Protect the primary checkout at C:/Users/Goncalo/Desktop/AI/AutoNunesMartins and every checkout outside the approved target. Stop if traversal can reach them. Never follow a junction or symbolic link outside the approved target during deletion.
- Preserve source, tests, configurations, .env files, ignored and untracked files, and unstaged or staged changes unless their disposal is explicitly authorized. Git ignore status, a clean status, merged commits, or a current remote does not establish that local files are disposable. Arrange appropriate protected preservation before authorized deletion; do not copy secrets to an insecure location.
- Do not use git worktree remove --force, archive operations, or recursive deletion on a checkout with unresolved shared links. Any link isolation/removal needs its own validated procedure that removes only the link and leaves the target untouched. Stop on a Git failure; never compensate with a recursive filesystem deletion.
- Never create node_modules junctions or equivalent dependency-directory links between checkouts. Use independent dependency installations; shared package caches must not expose another checkout's source to cleanup.
- Never reproduce destructive behavior against the real project, production resources, or real credentials. Use a disposable isolated environment without access to important files.
- These instructions constrain agent actions; they do not enforce restrictions on internal Codex Desktop workers. Disabling application automatic cleanup and adding operating-system isolation require their own authorized configuration changes. Do not claim that this file alone prevents another incident.

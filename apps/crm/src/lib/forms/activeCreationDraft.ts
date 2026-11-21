/** Route context only; never persists a read receipt or hides other drafts. */
export function activeCreationDraftId(
  url: URL,
  creationPath: string,
  vehicle?: { id: string; status: string } | null,
): string | undefined {
  const id = url.searchParams.get('viatura');
  return url.pathname === creationPath &&
    url.searchParams.getAll('viatura').length === 1 &&
    id &&
    vehicle?.id === id &&
    vehicle.status === 'DRAFT'
    ? id
    : undefined;
}

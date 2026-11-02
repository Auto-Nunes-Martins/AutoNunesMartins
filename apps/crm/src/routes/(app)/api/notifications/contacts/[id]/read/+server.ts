import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
  const id = event.params.id ?? '';
  if (!/^contact:[a-f0-9]{64}$/.test(id)) {
    return json({ error: 'Invalid notification' }, { status: 400 });
  }
  // An old tab's individual read action must never become a shared deletion.
  return json(
    { error: 'Atualize a página para gerir os avisos partilhados.' },
    {
      status: 410,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
};

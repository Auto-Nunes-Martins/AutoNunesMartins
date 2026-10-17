import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiJson, ApiError } from '$lib/server/api';
import { vehiclesApi } from '$lib/server/vehicles';

export const GET: RequestHandler = async event => {
  try {
    const vehicle = await vehiclesApi.get(event, event.params.id);
    const { photos: signedPhotos } = await vehiclesApi.signedPhotos(event, event.params.id);
    return json({ vehicle, signedPhotos }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return json({ error: 'Não foi possível confirmar a versão atual da viatura.' }, { status: error instanceof ApiError ? error.status : 503, headers: { 'cache-control': 'private, no-store' } });
  }
};
export const POST: RequestHandler = async event => {
  try {
    const result = await apiJson(event, `/api/vehicles/${event.params.id}/edit`, { method: 'PUT', body: JSON.stringify(await event.request.json()) });
    return json(result, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    const body = error instanceof ApiError ? error.body as {error?:string;field?:string;issues?:{path:(string|number)[];message:string}[]} : null;
    return json({ error: body?.error ?? 'Não foi possível confirmar a gravação. Recarregue e confirme a ficha antes de repetir.', ...(body?.field?{field:body.field}:{}), ...(body?.issues?{issues:body.issues.map(issue=>({path:issue.path,message:issue.message}))}:{}), ...(!(error instanceof ApiError)||error.status>=500?{outcomeUnknown:true}:{}) },
      { status: error instanceof ApiError ? error.status : 503, headers: { 'cache-control': 'private, no-store' } });
  }
};

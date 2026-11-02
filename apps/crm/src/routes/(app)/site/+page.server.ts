import { redirect } from '@sveltejs/kit';
import { crmPath } from '$lib/paths';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = () => {
  redirect(307, crmPath('/site/destaques'));
};

import type { Prisma } from '@prisma/client';
import { Prisma as PrismaValue } from '@prisma/client';
import { appliedCampaign, currentCampaign, readCampaigns } from '../data/campaignPricing.js';

export class WebPublicationError extends Error {
  constructor(
    public readonly status: 404 | 409,
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

/** Called inside the same serializable transaction that writes the base price. */
export async function assertCampaignBasePrice(
  tx: Pick<Prisma.TransactionClient, 'appSetting'>,
  id: string,
  price: string | null,
) {
  const { items } = await readCampaigns(tx);
  const campaign = items.find(
    (item) => item.vehicleId === id && appliedCampaign(item) && currentCampaign(item, Date.now()),
  );
  if (campaign && (price === null || new PrismaValue.Decimal(price).lte(campaign.price))) {
    throw new WebPublicationError(
      409,
      'O preço base tem de ser superior ao preço de campanha. Altere ou remova primeiro a campanha.',
      'salePrice',
    );
  }
}

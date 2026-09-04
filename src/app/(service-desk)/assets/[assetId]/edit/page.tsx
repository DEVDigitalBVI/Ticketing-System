import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssetForm } from "@/modules/assets/components/asset-form";
import { PageHeader } from "@/modules/service-desk/components/page-header";
import { AssetServiceError } from "@/server/assets/policy";
import { getAssetDetail, getAssetFormOptions } from "@/server/assets/service";
import { requireCurrentAccess } from "@/server/auth/authorization";

export const metadata: Metadata = { title: "Edit asset" };

export default async function EditAssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const access = await requireCurrentAccess("asset.manage", "/assets");
  const { assetId } = await params;
  try {
    const [asset, options] = await Promise.all([
      getAssetDetail(access, assetId),
      getAssetFormOptions(access),
    ]);
    const formAsset = {
      ...asset,
      procurement: asset.procurement
        ? { ...asset.procurement, purchaseCost: asset.procurement.purchaseCost?.toString() ?? null }
        : null,
    };
    return (
      <section className="view" aria-labelledby="edit-asset-title">
        <PageHeader
          backHref={`/assets/${asset.id}`}
          backLabel={asset.assetTag}
          eyebrow="Inventory record"
          title="Edit asset"
          titleId="edit-asset-title"
          lead="Update descriptive, lifecycle, purchase, and warranty context. Transfers and assignments remain in their own history."
        />
        <div className="form-layout asset-form-layout">
          <AssetForm options={options} asset={formAsset} />
        </div>
      </section>
    );
  } catch (error) {
    if (error instanceof AssetServiceError) notFound();
    throw error;
  }
}

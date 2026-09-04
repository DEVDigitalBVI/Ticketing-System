import type { Metadata } from "next";

import { AssetForm } from "@/modules/assets/components/asset-form";
import { PageHeader } from "@/modules/service-desk/components/page-header";
import { getAssetFormOptions } from "@/server/assets/service";
import { requireCurrentAccess } from "@/server/auth/authorization";

export const metadata: Metadata = { title: "Add asset" };

export default async function NewAssetPage() {
  const access = await requireCurrentAccess("asset.manage", "/assets");
  const options = await getAssetFormOptions(access);
  return (
    <section className="view" aria-labelledby="new-asset-title">
      <PageHeader
        backHref="/assets"
        backLabel="Asset inventory"
        eyebrow="Inventory record"
        title="Add an asset"
        titleId="new-asset-title"
        lead="Record the resort identifier separately from manufacturer and future external-system identifiers."
      />
      <div className="form-layout asset-form-layout">
        <AssetForm options={options} />
      </div>
    </section>
  );
}

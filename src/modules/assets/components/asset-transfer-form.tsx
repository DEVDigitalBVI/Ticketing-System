"use client";

import { useMemo, useState } from "react";

import type { AssetFormOptions } from "@/modules/assets/components/asset-form";

export function AssetTransferForm({
  asset,
  options,
}: {
  asset: {
    id: string;
    updatedAt: Date;
    propertyId: string;
    buildingAreaId: string | null;
    serviceLocationId: string | null;
  };
  options: AssetFormOptions;
}) {
  const [propertyId, setPropertyId] = useState(asset.propertyId);
  const [buildingId, setBuildingId] = useState(asset.buildingAreaId ?? "");
  const buildings = useMemo(
    () => options.buildings.filter((item) => item.propertyId === propertyId),
    [options.buildings, propertyId],
  );
  const locations = useMemo(
    () =>
      options.locations.filter(
        (item) => item.propertyId === propertyId && item.buildingAreaId === buildingId,
      ),
    [options.locations, propertyId, buildingId],
  );
  return (
    <form className="panel compact-asset-form" action="/auth/asset" method="post">
      <input type="hidden" name="intent" value="transfer" />
      <input type="hidden" name="assetId" value={asset.id} />
      <input type="hidden" name="expectedUpdatedAt" value={asset.updatedAt.toISOString()} />
      <h3>Transfer location</h3>
      <label>
        <span className="field-label">Property</span>
        <select
          name="propertyId"
          value={propertyId}
          onChange={(event) => {
            setPropertyId(event.target.value);
            setBuildingId("");
          }}
        >
          {options.properties.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">Building or area</span>
        <select
          name="buildingAreaId"
          value={buildingId}
          onChange={(event) => setBuildingId(event.target.value)}
        >
          <option value="">Property-level</option>
          {buildings.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">Room or outlet</span>
        <select
          name="serviceLocationId"
          key={buildingId}
          defaultValue={
            buildingId === (asset.buildingAreaId ?? "") ? (asset.serviceLocationId ?? "") : ""
          }
        >
          <option value="">No specific room</option>
          {locations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="field-label">Reason</span>
        <textarea name="reason" required minLength={2} maxLength={1000} rows={2} />
      </label>
      <button className="secondary-button" type="submit">
        Record transfer
      </button>
    </form>
  );
}

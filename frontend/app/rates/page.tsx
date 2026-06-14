"use client";

import { ResourcePage } from "@/components/ResourcePage";
import { money } from "@/lib/api";

export default function RatesPage() {
  return (
    <ResourcePage
      title="Shop Rate Rules"
      endpoint="/rates"
      historyEndpoint={(row) => `/rates/${row.id}/history`}
      fields={[
        { name: "shop_id", label: "Shop", type: "select", valueType: "number", optionEndpoint: "/shops", optionLabelKey: "name", required: true },
        { name: "sku_id", label: "SKU", type: "select", valueType: "number", optionEndpoint: "/skus", optionLabelKey: "display_name", required: true },
        { name: "fixed_sale_rate", label: "Fixed sale rate", type: "number", required: true },
        { name: "minimum_allowed_rate", label: "Minimum allowed rate", type: "number", required: true },
        { name: "effective_from", label: "Effective from", type: "date", required: true },
        { name: "is_active", label: "Active", type: "checkbox" }
      ]}
      columns={[
        { key: "id", label: "ID" },
        { key: "shop_id", label: "Shop ID" },
        { key: "sku_id", label: "SKU ID" },
        { key: "fixed_sale_rate", label: "Fixed", render: (row) => money(row.fixed_sale_rate) },
        { key: "minimum_allowed_rate", label: "Minimum", render: (row) => money(row.minimum_allowed_rate) },
        { key: "effective_from", label: "Effective" },
        { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") }
      ]}
    />
  );
}

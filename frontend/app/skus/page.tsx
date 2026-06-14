"use client";

import { ResourcePage } from "@/components/ResourcePage";
import { money } from "@/lib/api";

export default function SkusPage() {
  return (
    <ResourcePage
      title="SKUs, Prices & History"
      endpoint="/skus"
      historyEndpoint={(row) => `/skus/${row.id}/history`}
      fields={[
        { name: "product_id", label: "Product", type: "select", valueType: "number", required: true, optionEndpoint: "/products", optionLabelKey: "name" },
        { name: "size_mrp", label: "Printed MRP", type: "number", required: true },
        { name: "flavour", label: "Flavour" },
        { name: "pack_quantity", label: "Pack quantity", type: "number", required: true },
        {
          name: "unit_type",
          label: "Unit type",
          type: "select",
          options: [
            { label: "Packet", value: "packet" },
            { label: "Carton", value: "carton" },
            { label: "Bundle", value: "bundle" }
          ]
        },
        { name: "cost_price", label: "Cost price per packet", type: "number", required: true },
        { name: "default_sale_rate", label: "Default sale rate", type: "number", required: true },
        { name: "minimum_sale_rate", label: "Minimum allowed rate", type: "number", required: true },
        { name: "low_stock_threshold", label: "Low stock threshold", type: "number" },
        { name: "sku_code", label: "SKU code" },
        { name: "is_active", label: "Active", type: "checkbox" }
      ]}
      columns={[
        { key: "id", label: "ID" },
        { key: "display_name", label: "SKU" },
        { key: "pack_quantity", label: "Pack" },
        { key: "cost_price", label: "Cost", render: (row) => money(row.cost_price) },
        { key: "default_sale_rate", label: "Sale", render: (row) => money(row.default_sale_rate) },
        { key: "minimum_sale_rate", label: "Min", render: (row) => money(row.minimum_sale_rate) },
        { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") }
      ]}
    />
  );
}

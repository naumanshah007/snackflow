"use client";

import { ResourcePage } from "@/components/ResourcePage";
import { money } from "@/lib/api";
import { perCarton } from "@/lib/cartons";

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
        { name: "pack_quantity", label: "Pack quantity (packets per carton)", type: "number", required: true },
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
        { name: "cost_price", label: "Cost price PER PACKET (carton = packet × pack qty)", type: "number", required: true },
        { name: "default_sale_rate", label: "Default sale rate PER PACKET", type: "number", required: true },
        { name: "minimum_sale_rate", label: "Minimum allowed rate PER PACKET", type: "number", required: true },
        { name: "low_stock_threshold", label: "Low stock threshold (packets)", type: "number" },
        { name: "sku_code", label: "SKU code" },
        { name: "is_active", label: "Active", type: "checkbox" }
      ]}
      columns={[
        { key: "display_name", label: "SKU" },
        { key: "pack_quantity", label: "Pack" },
        {
          key: "cost_per_carton",
          label: "Cost / Carton",
          render: (row) => (
            <div>
              <div className="font-semibold text-slate-900">{money(row.cost_per_carton ?? perCarton(row.cost_price, row.pack_quantity))}</div>
              <div className="text-xs text-slate-500">{money(row.cost_price)}/packet</div>
            </div>
          )
        },
        {
          key: "default_sale_rate_per_carton",
          label: "Sale / Carton",
          render: (row) => (
            <div>
              <div className="font-semibold text-slate-900">{money(row.default_sale_rate_per_carton ?? perCarton(row.default_sale_rate, row.pack_quantity))}</div>
              <div className="text-xs text-slate-500">{money(row.default_sale_rate)}/packet</div>
            </div>
          )
        },
        {
          key: "minimum_sale_rate_per_carton",
          label: "Min / Carton",
          render: (row) => money(row.minimum_sale_rate_per_carton ?? perCarton(row.minimum_sale_rate, row.pack_quantity))
        },
        { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") }
      ]}
    />
  );
}

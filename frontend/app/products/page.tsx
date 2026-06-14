"use client";

import { ResourcePage } from "@/components/ResourcePage";

export default function ProductsPage() {
  return (
    <ResourcePage
      title="Products"
      endpoint="/products"
      fields={[
        { name: "name", label: "Product name", required: true },
        { name: "category_name", label: "Category" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "is_active", label: "Active", type: "checkbox" }
      ]}
      columns={[
        { key: "id", label: "ID" },
        { key: "name", label: "Product" },
        { key: "category_id", label: "Category ID" },
        { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") }
      ]}
    />
  );
}

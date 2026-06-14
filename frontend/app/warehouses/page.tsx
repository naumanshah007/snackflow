"use client";

import { ResourcePage } from "@/components/ResourcePage";

export default function WarehousesPage() {
  return (
    <ResourcePage
      title="Warehouses"
      endpoint="/warehouses"
      fields={[
        { name: "name", label: "Warehouse name", required: true },
        { name: "address", label: "Address", type: "textarea" },
        { name: "manager", label: "Manager" },
        { name: "phone", label: "Phone" },
        { name: "is_active", label: "Active", type: "checkbox" }
      ]}
      columns={[
        { key: "id", label: "ID" },
        { key: "name", label: "Warehouse" },
        { key: "manager", label: "Manager" },
        { key: "phone", label: "Phone" },
        { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") }
      ]}
    />
  );
}

"use client";

import { ResourcePage } from "@/components/ResourcePage";

export default function UsersPage() {
  return (
    <ResourcePage
      title="Users & Roles"
      endpoint="/users"
      description="Admin can reset order booker passwords from here. Leave password blank if you do not want to change it."
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "username", label: "Username", required: true },
        {
          name: "password",
          label: "Password reset",
          type: "password",
          requiredOnCreate: true,
          placeholder: "Leave blank to keep existing password. Enter new password to reset.",
          helpText: "Leave blank to keep existing password. Enter new password to reset."
        },
        { name: "phone", label: "Phone" },
        {
          name: "role",
          label: "Role",
          type: "select",
          required: true,
          options: [
            { label: "Owner", value: "OWNER" },
            { label: "Warehouse Manager", value: "WAREHOUSE_MANAGER" },
            { label: "Order Booker", value: "ORDER_BOOKER" },
            { label: "Accountant", value: "ACCOUNTANT" }
          ]
        },
        { name: "assigned_warehouse_id", label: "Assigned warehouse", type: "select", valueType: "number", optionEndpoint: "/warehouses", optionLabelKey: "name" },
        { name: "route_days", label: "Working / route days", type: "weekdays" },
        { name: "is_active", label: "Active", type: "checkbox" }
      ]}
      columns={[
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
        { key: "username", label: "Username" },
        { key: "role", label: "Role" },
        { key: "assigned_warehouse_id", label: "Warehouse" },
        { key: "route_days", label: "Route days", render: (row) => ((row.route_days || []).length ? (row.route_days as string[]).map((d) => d.slice(0, 3)).join(", ") : "—") },
        { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") }
      ]}
    />
  );
}

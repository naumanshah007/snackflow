"use client";

import { ResourcePage } from "@/components/ResourcePage";
import { money } from "@/lib/api";

const categories = [
  "PETROL",
  "VEHICLE_MAINTENANCE",
  "SALARIES",
  "RENT",
  "UTILITY_BILLS",
  "LABOUR_CHARGES",
  "LOADING_UNLOADING",
  "MISCELLANEOUS",
  "OTHER"
].map((category) => ({ label: category.replaceAll("_", " "), value: category }));

export default function ExpensesPage() {
  return (
    <ResourcePage
      title="Expenses"
      endpoint="/expenses"
      fields={[
        { name: "expense_date", label: "Date", type: "date", required: true },
        { name: "category", label: "Category", type: "select", required: true, options: categories },
        { name: "amount", label: "Amount", type: "number", required: true },
        { name: "warehouse_id", label: "Warehouse", type: "select", valueType: "number", optionEndpoint: "/warehouses", optionLabelKey: "name" },
        { name: "order_booker_id", label: "Order booker", type: "select", valueType: "number", optionEndpoint: "/users", optionLabelKey: "name" },
        { name: "description", label: "Description", type: "textarea" }
      ]}
      columns={[
        { key: "expense_date", label: "Date" },
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount", render: (row) => money(row.amount) },
        { key: "warehouse_id", label: "Warehouse" },
        { key: "description", label: "Description" }
      ]}
    />
  );
}

import type React from "react";

export type Option = {
  label: string;
  value: string | number;
};

export type AnyRow = Record<string, any>;

export type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "checkbox" | "password" | "weekdays";
  valueType?: "string" | "number" | "boolean";
  required?: boolean;
  requiredOnCreate?: boolean;
  options?: Option[];
  optionEndpoint?: string;
  optionLabelKey?: string;
  optionValueKey?: string;
  placeholder?: string;
  helpText?: string;
};

export type ColumnConfig = {
  key: string;
  label: string;
  render?: (row: AnyRow) => React.ReactNode;
};

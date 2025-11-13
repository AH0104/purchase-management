export type SmaregiDepartment = {
  departmentId: string;
  name: string;
  parentDepartmentId?: string | null;
  level?: number | null;
};

export type SmaregiProduct = {
  productCode: string;
  productId?: string | null;
  departmentId?: string | null;
};

export type SmaregiStockRecord = {
  productCode: string;
  departmentId?: string | null;
  shopId: string;
  quantity: number;
  unit?: string | null;
};

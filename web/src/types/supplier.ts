export type Supplier = {
  id: number;
  supplier_code: string;
  supplier_name: string;
  payment_terms: number | null;
  is_active: boolean;
  contact_person?: string | null;
  contact_email?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SupplierInput = {
  supplier_code: string;
  supplier_name: string;
  payment_terms: number | null;
  is_active: boolean;
  contact_person?: string | null;
  contact_email?: string | null;
};



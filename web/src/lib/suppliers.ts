import { supabase } from "@/lib/supabaseClient";
import { Supplier } from "@/types/supplier";

export async function fetchActiveSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, supplier_code, supplier_name, payment_terms, is_active")
    .eq("is_active", true)
    .order("supplier_name", { ascending: true });

  if (error) {
    console.error("Failed to fetch suppliers", error);
    throw error;
  }

  return data ?? [];
}









import { z } from "zod";

export const deliveryNoteItemSchema = z.object({
  lineNumber: z.number().int().min(1),
  deliveryDate: z.string().optional(), // 明細行ごとの納品日
  deliveryNoteNumber: z.string().nullable().optional(),
  productCode: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().finite().nonnegative(),
  unitPrice: z.number().finite().nonnegative(),
  amount: z.number().finite(),
  remarks: z.string().nullable().optional(),
});

export const deliveryNoteSchema = z.object({
  supplierId: z.number().int().min(1),
  supplierName: z.string().optional(),
  deliveryDate: z.string().optional().default(""),
  totalAmount: z.number().finite().nonnegative(),
  originalFileName: z.string().min(1),
  fileType: z.string().min(1),
  items: z.array(deliveryNoteItemSchema).min(1),
});

export type DeliveryNoteFormData = z.infer<typeof deliveryNoteSchema>;



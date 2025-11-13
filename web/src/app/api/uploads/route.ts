import { NextResponse } from "next/server";
import { parseExcelFile } from "@/lib/parsers/excel";
import { parseCsvFile } from "@/lib/parsers/csv";
import { parsePdfWithGemini } from "@/lib/parsers/pdf";
import { ZodError } from "zod";
import { deliveryNoteSchema } from "@/lib/validators/delivery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const supplierIdValue = formData.get("supplierId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ファイルが取得できません" }, { status: 400 });
    }

    const supplierId = Number(supplierIdValue);
    if (!supplierId || Number.isNaN(supplierId)) {
      return NextResponse.json({ error: "仕入先が選択されていません" }, { status: 400 });
    }

    const fileName = file.name;
    const lowerName = fileName.toLowerCase();
    const result = await (async () => {
      if (lowerName.endsWith(".pdf")) {
        const buffer = await file.arrayBuffer();
        return parsePdfWithGemini({ buffer, supplierId, fileName });
      }
      if (lowerName.endsWith(".csv")) {
        return parseCsvFile({ file, supplierId });
      }
      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        return parseExcelFile({ file, supplierId });
      }
      throw new Error("対応していないファイル形式です");
    })();

    try {
      const validated = deliveryNoteSchema.parse(result.deliveryNote);
      return NextResponse.json({ ...result, deliveryNote: validated });
    } catch (error) {
      if (error instanceof ZodError) {
        const hasItemsError = error.issues.some((issue) => issue.path[0] === "items");
        console.error("Validation error:", error.issues);
        console.error("Parsed result:", JSON.stringify(result.deliveryNote, null, 2));
        const message = hasItemsError
          ? `明細行が抽出できませんでした（抽出された明細数: ${result.deliveryNote.items?.length ?? 0}）。内容を確認して再アップロードするか、別形式のファイルをご利用ください。`
          : "抽出結果に不足があります。入力内容を確認してください。";
        return NextResponse.json({ error: message, issues: error.issues }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "アップロード処理でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



import { getGeminiModel } from "@/lib/gemini";
import { UploadParseResult } from "@/types/delivery";
import { normalizeNumber, normalizeDate } from "./utils";

type PdfParseOptions = {
  buffer: ArrayBuffer;
  supplierId: number;
  fileName: string;
};

type GeminiDeliveryResponse = {
  deliveryDate?: string;
  supplierName?: string;
  totalAmount?: number;
  items?: Array<{
    deliveryDate?: string; // 明細行ごとの納品日
    deliveryNoteNumber?: string;
    productCode?: string;
    productName?: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
    remarks?: string;
  }>;
};

export async function parsePdfWithGemini({
  buffer,
  supplierId,
  fileName,
}: PdfParseOptions): Promise<UploadParseResult> {
  const base64 = Buffer.from(buffer).toString("base64");
  const model = getGeminiModel("gemini-2.5-flash");
  
  const prompt = `以下の納品書PDFから情報を抽出し、以下のJSON形式で出力してください。JSON以外のテキストは一切含めないでください。
金額は税抜き金額のみを抽出してください。消費税や税込み金額は不要です。

最重要：必ず全ての明細行（商品行）を抽出してください。商品コード、商品名、数量、単価、金額が記載されている全ての行を items 配列に含めてください。

納品日について：1つのファイルに複数の納品日が含まれる場合があります。各明細行に記載されている納品日を確認し、明細行ごとに異なる場合は各行に記載してください。明細行に納品日が記載されていない場合は、ヘッダーや上部に記載されている納品日を使用してください。

納品書番号について：納品書の上部や各明細行に記載されている「納品書番号」「伝票番号」「NO.」などの欄を確認し、明細行ごとに異なる場合は各行に記載してください。見つからない場合は null を設定してください。

{
  "deliveryDate": "納品日（YYYY-MM-DD形式、ヘッダーや最初の明細行の納品日）",
  "supplierName": "仕入先名",
  "totalAmount": 合計金額（税抜き、数値のみ）,
  "items": [
    {
      "deliveryDate": "納品日（YYYY-MM-DD形式、明細行ごとに異なる場合は各行に記載。見つからない場合はnull）",
      "deliveryNoteNumber": "納品書番号（必ず抽出。明細行ごとに異なる場合は各行に記載。見つからない場合はnull）",
      "productCode": "商品コード",
      "productName": "商品名",
      "quantity": 数量（数値）,
      "unitPrice": 単価（数値）,
      "amount": 金額（税抜き、数値）,
      "remarks": "備考（あれば）"
    }
  ]
}`;

  const result = await model.generateContent([
    {
      text: prompt,
    },
    {
      inlineData: {
        mimeType: "application/pdf",
        data: base64,
      },
    },
  ]);

  const text = result.response.text();
  console.log("Gemini raw response (first 500 chars):", text.slice(0, 500));
  
  let parsed: GeminiDeliveryResponse = {};
  let jsonText = text.trim();
  
  // まずコードブロックを除去（改行を含む場合にも対応）
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch?.[1]) {
    jsonText = codeBlockMatch[1].trim();
  } else {
    // コードブロック形式でない場合、最初の { から最後の } までを抽出
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }
  }
  
  try {
    parsed = JSON.parse(jsonText);
  } catch (parseError) {
    console.error("JSON parse error:", parseError);
    console.error("Attempted to parse:", jsonText.slice(0, 300));
    throw new Error(`Gemini 応答の JSON 解析に失敗しました。応答: ${text.slice(0, 200)}`);
  }

  const headerDeliveryDate = normalizeDate(parsed.deliveryDate ?? "");
  
  const items = (parsed.items ?? []).map((item, index) => {
    // 明細行の納品日がない場合はヘッダーの納品日を使用
    const itemDeliveryDate = item.deliveryDate 
      ? normalizeDate(item.deliveryDate) 
      : headerDeliveryDate;
    
    return {
      lineNumber: index + 1,
      deliveryDate: itemDeliveryDate,
      deliveryNoteNumber: item.deliveryNoteNumber !== null ? item.deliveryNoteNumber : undefined,
      productCode: item.productCode ?? "",
      productName: item.productName ?? "",
      quantity: item.quantity ?? 0,
      unitPrice: item.unitPrice ?? 0,
      amount: item.amount ?? 0,
      remarks: item.remarks !== null ? item.remarks : undefined,
    };
  });

  if (items.length === 0) {
    console.error("No items extracted from PDF");
    console.error("Parsed object:", JSON.stringify(parsed, null, 2));
  }

  return {
    deliveryNote: {
      supplierId,
      supplierName: parsed.supplierName,
      deliveryDate: normalizeDate(parsed.deliveryDate ?? ""),
      totalAmount: normalizeNumber(parsed.totalAmount ?? 0),
      originalFileName: fileName,
      fileType: "pdf",
      items,
    },
    warnings: items.length === 0 ? ["明細行が抽出できませんでした"] : [],
    rawPayload: parsed,
  };
}




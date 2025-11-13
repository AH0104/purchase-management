"use client";

import { useEffect, useState } from "react";
import { Supplier } from "@/types/supplier";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { FileFormatTemplate, SYSTEM_FIELDS, ColumnMappingField } from "@/types/file-format";
import { TemplateEditDialog } from "@/components/TemplateEditDialog";

type SupplierFormData = {
  supplier_code: string;
  supplier_name: string;
  payment_terms: number | null;
  is_active: boolean;
  contact_person: string | null;
  contact_email: string | null;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [keyword, setKeyword] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<string>("true");
  const [selectedSupplierForTemplates, setSelectedSupplierForTemplates] = useState<Supplier | null>(null);
  const [templates, setTemplates] = useState<FileFormatTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FileFormatTemplate | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormData>({
    defaultValues: {
      supplier_code: "",
      supplier_name: "",
      payment_terms: null,
      is_active: true,
      contact_person: null,
      contact_email: null,
    },
  });

  useEffect(() => {
    fetchSuppliers();
  }, [keyword, isActiveFilter]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      if (isActiveFilter !== "") params.set("isActive", isActiveFilter);

      const res = await fetch(`/api/suppliers?${params.toString()}`);
      if (!res.ok) throw new Error("仕入先の取得に失敗しました");
      const data = await res.json();
      setSuppliers(data.data || []);
    } catch (error) {
      console.error(error);
      toast.error("仕入先の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingSupplier(null);
    reset({
      supplier_code: "",
      supplier_name: "",
      payment_terms: null,
      is_active: true,
      contact_person: null,
      contact_email: null,
    });
    setShowDrawer(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    reset({
      supplier_code: supplier.supplier_code,
      supplier_name: supplier.supplier_name,
      payment_terms: supplier.payment_terms,
      is_active: supplier.is_active,
      contact_person: supplier.contact_person || null,
      contact_email: supplier.contact_email || null,
    });
    setShowDrawer(true);
  };

  const validateForm = (data: SupplierFormData): string | null => {
    if (!data.supplier_code.trim()) {
      return "仕入先コードは必須です";
    }
    if (!data.supplier_name.trim()) {
      return "仕入先名は必須です";
    }
    if (data.contact_email && data.contact_email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.contact_email)) {
        return "有効なメールアドレスを入力してください";
      }
    }
    return null;
  };

  const onSubmit = async (data: SupplierFormData) => {
    const validationError = validateForm(data);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      if (editingSupplier) {
        // 更新
        const res = await fetch(`/api/suppliers/${editingSupplier.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "更新に失敗しました");
        }

        toast.success("仕入先を更新しました");
      } else {
        // 新規登録
        const res = await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "登録に失敗しました");
        }

        toast.success("仕入先を登録しました");
      }

      setShowDrawer(false);
      setEditingSupplier(null);
      fetchSuppliers();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "処理に失敗しました");
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`「${supplier.supplier_name}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "削除に失敗しました");
      }

      const result = await res.json();
      toast.success(result.message || "削除しました");
      fetchSuppliers();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "削除に失敗しました");
    }
  };

  const handleViewTemplates = async (supplier: Supplier) => {
    setSelectedSupplierForTemplates(supplier);
    setLoadingTemplates(true);
    try {
      const res = await fetch(`/api/file-formats/templates?supplierId=${supplier.id}`);
      if (!res.ok) throw new Error("テンプレートの取得に失敗しました");
      const data = await res.json();
      setTemplates(data.data || []);
    } catch (error) {
      console.error(error);
      toast.error("テンプレートの取得に失敗しました");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm("このテンプレートを削除してもよろしいですか？")) {
      return;
    }

    try {
      const res = await fetch(`/api/file-formats/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "削除に失敗しました");
      }

      toast.success("テンプレートを削除しました");
      if (selectedSupplierForTemplates) {
        handleViewTemplates(selectedSupplierForTemplates);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "削除に失敗しました");
    }
  };

  const handleEditTemplateClick = (template: FileFormatTemplate) => {
    setEditingTemplate(template);
  };

  const handleTemplateUpdated = (template: FileFormatTemplate) => {
    setTemplates((prev) => prev.map((item) => (item.id === template.id ? template : item)));
    setEditingTemplate(null);
  };

  const fieldLabel = (field: string) => {
    const info = SYSTEM_FIELDS[field as ColumnMappingField];
    return info ? info.label : field;
  };

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">仕入先管理</h1>
      <div className="flex items-center gap-3">
        <input
          placeholder="検索（名称・コード）"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="h-10 w-72 border rounded px-3"
        />
        <select
          value={isActiveFilter}
          onChange={(e) => setIsActiveFilter(e.target.value)}
          className="h-10 border rounded px-2"
        >
          <option value="">すべて</option>
          <option value="true">アクティブ</option>
          <option value="false">非アクティブ</option>
        </select>
        <button
          onClick={handleNew}
          className="ml-auto h-10 px-4 rounded bg-teal-600 text-white hover:bg-teal-700"
        >
          新規登録
        </button>
      </div>
      <div className="rounded-lg border bg-white p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-500">読み込み中...</div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">データがありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left p-3">名称</th>
                <th className="text-left p-3">コード</th>
                <th className="text-left p-3">支払条件</th>
                <th className="text-left p-3">担当者</th>
                <th className="text-left p-3">連絡先メール</th>
                <th className="text-left p-3">状態</th>
                <th className="p-3 w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-t hover:bg-slate-50">
                  <td className="p-3">{supplier.supplier_name}</td>
                  <td className="p-3">{supplier.supplier_code}</td>
                  <td className="p-3">
                    {supplier.payment_terms ? `${supplier.payment_terms}日` : "-"}
                  </td>
                  <td className="p-3">{supplier.contact_person || "-"}</td>
                  <td className="p-3">{supplier.contact_email || "-"}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        supplier.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {supplier.is_active ? "アクティブ" : "非アクティブ"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="text-teal-600 hover:text-teal-700 text-sm"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleViewTemplates(supplier)}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        ファイル形式
                      </button>
                      <button
                        onClick={() => handleDelete(supplier)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ドロワーフォーム */}
      {showDrawer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-md overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingSupplier ? "仕入先編集" : "仕入先新規登録"}
              </h2>
              <button
                onClick={() => {
                  setShowDrawer(false);
                  setEditingSupplier(null);
                  reset();
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  仕入先コード <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("supplier_code", { required: "仕入先コードは必須です" })}
                  className="w-full h-10 border rounded px-3"
                  disabled={!!editingSupplier}
                />
                {errors.supplier_code && (
                  <p className="mt-1 text-sm text-red-600">{errors.supplier_code.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  仕入先名 <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("supplier_name", { required: "仕入先名は必須です" })}
                  className="w-full h-10 border rounded px-3"
                />
                {errors.supplier_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.supplier_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  支払条件（日数）
                </label>
                <input
                  type="number"
                  {...register("payment_terms", { valueAsNumber: true })}
                  className="w-full h-10 border rounded px-3"
                  placeholder="例: 30"
                />
                {errors.payment_terms && (
                  <p className="mt-1 text-sm text-red-600">{errors.payment_terms.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">担当者</label>
                <input
                  {...register("contact_person")}
                  className="w-full h-10 border rounded px-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  連絡先メール
                </label>
                <input
                  type="email"
                  {...register("contact_email", {
                    validate: (value) => {
                      if (value && value.trim()) {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        return emailRegex.test(value) || "有効なメールアドレスを入力してください";
                      }
                      return true;
                    },
                  })}
                  className="w-full h-10 border rounded px-3"
                />
                {errors.contact_email && (
                  <p className="mt-1 text-sm text-red-600">{errors.contact_email.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("is_active")}
                  id="is_active"
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                  アクティブ
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDrawer(false);
                    setEditingSupplier(null);
                    reset();
                  }}
                  className="flex-1 h-10 px-4 rounded border hover:bg-slate-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-10 px-4 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isSubmitting ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* テンプレート管理ドロワー */}
      {selectedSupplierForTemplates && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-2xl overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {selectedSupplierForTemplates.supplier_name} - ファイル形式テンプレート
              </h2>
              <button
                onClick={() => {
                  setSelectedSupplierForTemplates(null);
                  setTemplates([]);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {loadingTemplates ? (
                <div className="text-center py-12 text-slate-500">読み込み中...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  テンプレートが登録されていません
                  <br />
                  <span className="text-sm">
                    ファイルアップロード時にマッピングを設定すると、テンプレートとして保存されます
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border rounded p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">
                            {template.file_type === "excel" ? "Excel" : "CSV"} 形式
                          </h3>
                          <p className="text-sm text-slate-500">
                            作成日: {new Date(template.created_at).toLocaleDateString("ja-JP")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleEditTemplateClick(template)}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="font-medium">ヘッダー行:</span> {template.header_row_index + 1}行目
                        </p>
                        <p>
                          <span className="font-medium">データ開始行:</span> {template.data_start_row_index + 1}行目
                        </p>
                        <div className="mt-2">
                          <span className="font-medium">マッピング:</span>
                          <ul className="list-disc ml-5 mt-1">
                            {Object.entries(template.column_mapping).map(([field, config]) => (
                              <li key={field}>
                                {fieldLabel(field)}: {config.column}
                                {config.header_name && ` (${config.header_name})`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {editingTemplate && (
        <TemplateEditDialog
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onUpdated={handleTemplateUpdated}
        />
      )}
    </div>
  );
}

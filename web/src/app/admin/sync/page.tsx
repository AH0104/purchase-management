"use client";

import { useState } from "react";

type SyncResult = {
  ok: boolean;
  summary?: {
    departmentCount: number;
    productCount: number;
    syncedAt: string;
  };
  error?: string;
};

type DrivePollResult = {
  status: string;
  processedCount: number;
  skippedCount: number;
  errorCount: number;
};

export default function AdminSyncPage() {
  const [smaregiLoading, setSmaregiLoading] = useState(false);
  const [smaregiResult, setSmaregiResult] = useState<SyncResult | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveResult, setDriveResult] = useState<DrivePollResult | null>(null);

  const handleSmaregiSync = async () => {
    setSmaregiLoading(true);
    setSmaregiResult(null);

    try {
      const res = await fetch("/api/smaregi/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();
      setSmaregiResult(data);
    } catch (error) {
      setSmaregiResult({
        ok: false,
        error: error instanceof Error ? error.message : "同期に失敗しました",
      });
    } finally {
      setSmaregiLoading(false);
    }
  };

  const handleDrivePoll = async () => {
    setDriveLoading(true);
    setDriveResult(null);

    try {
      const res = await fetch("/api/drive/poll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();
      setDriveResult(data);
    } catch (error) {
      setDriveResult({
        status: "error",
        processedCount: 0,
        skippedCount: 0,
        errorCount: 1,
      });
    } finally {
      setDriveLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">管理者向け同期ツール</h1>

      {/* スマレジ同期 */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">スマレジ同期</h2>
        <p className="text-sm text-gray-600 mb-4">
          スマレジから部門情報と商品情報を手動で同期します。
          <br />
          環境変数が正しく設定されているか確認できます。
        </p>

        <button
          onClick={handleSmaregiSync}
          disabled={smaregiLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {smaregiLoading ? "同期中..." : "スマレジ同期を実行"}
        </button>

        {smaregiResult && (
          <div className={`mt-4 p-4 rounded ${smaregiResult.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            {smaregiResult.ok && smaregiResult.summary ? (
              <div>
                <p className="font-semibold text-green-800 mb-2">✓ 同期成功</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>部門数: {smaregiResult.summary.departmentCount}</li>
                  <li>新規商品数: {smaregiResult.summary.productCount}</li>
                  <li>同期日時: {new Date(smaregiResult.summary.syncedAt).toLocaleString("ja-JP")}</li>
                </ul>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-red-800 mb-2">✗ エラー</p>
                <p className="text-sm text-red-700">{smaregiResult.error}</p>
                <details className="mt-2 text-xs text-gray-600">
                  <summary className="cursor-pointer">トラブルシューティング</summary>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Vercelの環境変数が設定されているか確認</li>
                    <li>SMAREGI_CLIENT_ID, SMAREGI_CLIENT_SECRET が正しいか確認</li>
                    <li>SMAREGI_TENANT_ID, SMAREGI_SHOP_ID が正しいか確認</li>
                    <li>スマレジAPIのスコープに products.read departments.read が含まれているか確認</li>
                  </ul>
                </details>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google Drive ポーリング */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Google Drive ポーリング</h2>
        <p className="text-sm text-gray-600 mb-4">
          Google Driveの監視フォルダ内の新しいファイルを手動でチェックします。
          <br />
          自動アップロードが動作しているか確認できます。
        </p>

        <button
          onClick={handleDrivePoll}
          disabled={driveLoading}
          className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {driveLoading ? "ポーリング中..." : "Driveポーリングを実行"}
        </button>

        {driveResult && (
          <div className={`mt-4 p-4 rounded ${driveResult.status === "ok" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            {driveResult.status === "ok" ? (
              <div>
                <p className="font-semibold text-green-800 mb-2">✓ ポーリング成功</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>処理済み: {driveResult.processedCount}件</li>
                  <li>スキップ: {driveResult.skippedCount}件</li>
                  <li>エラー: {driveResult.errorCount}件</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  ※ 処理済みファイルは「納品データ」ページで確認できます
                </p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-red-800 mb-2">✗ エラー</p>
                <details className="mt-2 text-xs text-gray-600">
                  <summary className="cursor-pointer">トラブルシューティング</summary>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Google Drive APIの認証情報が正しく設定されているか確認</li>
                    <li>GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET が設定されているか確認</li>
                    <li>GOOGLE_REFRESH_TOKEN が有効か確認</li>
                    <li>GOOGLE_DRIVE_WATCH_FOLDER_ID が正しいフォルダIDか確認</li>
                  </ul>
                </details>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">
          <strong>注意:</strong> このページは管理者専用です。本番環境では適切な認証を追加してください。
        </p>
      </div>
    </div>
  );
}

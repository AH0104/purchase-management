import { UploadParseResult } from "@/types/delivery";

type UploadOptions = {
  file: File;
  supplierId: number;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
};

export function uploadFileWithProgress({
  file,
  supplierId,
  onProgress,
  signal,
}: UploadOptions): Promise<UploadParseResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("supplierId", String(supplierId));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.responseType = "json";

    if (signal) {
      const abortHandler = () => {
        xhr.abort();
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as UploadParseResult);
      } else {
        const message = (xhr.response && xhr.response.error) || "アップロードに失敗しました";
        reject(new Error(message));
      }
    };

    xhr.onerror = () => {
      reject(new Error("アップロード中にエラーが発生しました"));
    };

    xhr.send(formData);
  });
}









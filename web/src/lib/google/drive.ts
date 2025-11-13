import { google, drive_v3 } from "googleapis";

type FolderPathSegment = {
  id: string;
  name: string;
};

type DriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  watchFolderId: string;
  processedFolderId: string | null;
  pendingFolderId: string | null;
};

let cachedDrive: drive_v3.Drive | null = null;
let cachedAuthClient: drive_v3.Options["auth"] | null = null;

function getDriveConfig(): DriveConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const watchFolderId = process.env.GOOGLE_DRIVE_WATCH_FOLDER_ID;
  const processedFolderId = process.env.GOOGLE_DRIVE_PROCESSED_FOLDER_ID || null;
  const pendingFolderId = process.env.GOOGLE_DRIVE_PENDING_FOLDER_ID || null;

  if (!clientId || !clientSecret || !refreshToken || !watchFolderId) {
    throw new Error("Google Drive の環境変数が不足しています。clientId, clientSecret, refreshToken, watchFolderId を設定してください。");
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    watchFolderId,
    processedFolderId,
    pendingFolderId,
  };
}

async function createAuthClient(): Promise<drive_v3.Options["auth"]> {
  const { clientId, clientSecret, refreshToken } = getDriveConfig();

  const auth = new google.auth.OAuth2({
    clientId,
    clientSecret,
  });
  auth.setCredentials({ refresh_token: refreshToken });

  // トークンを更新して検証
  await auth.getAccessToken();

  return auth;
}

async function ensureDriveClient(): Promise<drive_v3.Drive> {
  if (cachedDrive && cachedAuthClient) {
    return cachedDrive;
  }

  const authClient = await createAuthClient();
  cachedAuthClient = authClient;
  cachedDrive = google.drive({ version: "v3", auth: authClient });
  return cachedDrive;
}

export async function getDriveClient(): Promise<drive_v3.Drive> {
  return ensureDriveClient();
}

export async function getDriveFolders(): Promise<{
  watchFolderId: string;
  processedFolderId: string | null;
  pendingFolderId: string | null;
}> {
  const { watchFolderId, processedFolderId, pendingFolderId } = getDriveConfig();
  return { watchFolderId, processedFolderId, pendingFolderId };
}

export async function ensureStartPageToken(drive: drive_v3.Drive): Promise<string> {
  const response = await drive.changes.getStartPageToken({ supportsAllDrives: true });
  const startPageToken = response.data.startPageToken;
  if (!startPageToken) {
    throw new Error("Drive の startPageToken を取得できませんでした");
  }
  return startPageToken;
}

type FolderCacheEntry = {
  segment: FolderPathSegment;
  parents: string[] | null;
};

async function fetchFolderPathSegments(
  drive: drive_v3.Drive,
  folderId: string,
  watchFolderId: string,
  cache: Map<string, FolderCacheEntry>
): Promise<{ segments: FolderPathSegment[]; foundWatchFolder: boolean }> {
  const segments: FolderPathSegment[] = [];
  let currentId: string | undefined | null = folderId;
  let foundWatchFolder = false;

  while (currentId) {
    if (currentId === watchFolderId) {
      foundWatchFolder = true;
      break;
    }

    const cached = cache.get(currentId);
    if (cached) {
      segments.unshift(cached.segment);
      currentId = cached.parents?.[0] ?? null;
      continue;
    }

    const res = await drive.files.get({
      fileId: currentId,
      fields: "id, name, parents",
      supportsAllDrives: true,
    });

    const data = res.data;
    if (!data.id || !data.name) break;

    const entry: FolderCacheEntry = {
      segment: { id: data.id, name: data.name },
      parents: data.parents ?? null,
    };

    cache.set(entry.segment.id, entry);
    segments.unshift(entry.segment);
    currentId = entry.parents?.[0] ?? null;
  }

  return { segments, foundWatchFolder };
}

export async function buildFilePath(
  drive: drive_v3.Drive,
  file: drive_v3.Schema$File,
  watchFolderId: string
): Promise<{
  segments: FolderPathSegment[];
  parentFolderId: string | null;
  parentFolderName: string | null;
  isUnderWatchFolder: boolean;
}> {
  const parentId = file.parents?.[0] ?? null;
  if (!parentId) {
    return {
      segments: [],
      parentFolderId: null,
      parentFolderName: null,
      isUnderWatchFolder: false,
    };
  }

  const cache = new Map<string, FolderCacheEntry>();
  const { segments, foundWatchFolder } = await fetchFolderPathSegments(drive, parentId, watchFolderId, cache);
  const parentSegments = segments.length > 0 ? segments[segments.length - 1] : null;

  return {
    segments,
    parentFolderId: parentSegments?.id ?? parentId,
    parentFolderName: parentSegments?.name ?? null,
    isUnderWatchFolder: foundWatchFolder || (file.parents ?? []).includes(watchFolderId),
  };
}

export async function listFilesInFolder(
  drive: drive_v3.Drive,
  folderId: string,
  options?: { pageSize?: number }
): Promise<drive_v3.Schema$File[]> {
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, parents, md5Checksum, webViewLink, size, createdTime, modifiedTime)",
      orderBy: "createdTime desc",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
      pageSize: options?.pageSize ?? 100,
    });
    if (response.data.files) {
      files.push(...response.data.files);
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = await ensureDriveClient();
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(response.data as ArrayBuffer);
}

export async function moveFileToFolder(fileId: string, destinationFolderId: string): Promise<void> {
  const drive = await ensureDriveClient();
  const metadata = await drive.files.get({
    fileId,
    fields: "id, parents",
    supportsAllDrives: true,
  });
  const parents = metadata.data.parents ?? [];
  await drive.files.update({
    fileId,
    addParents: destinationFolderId,
    removeParents: parents.join(","),
    fields: "id, parents",
    supportsAllDrives: true,
  });
}

export function normalizeSupplierKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[\s_\\-]+/g, "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    )
    .replace(/[（）\(\)［］\[\]【】<>「」『』"'`]/g, "");
}

export function inferSupplierFromPath(
  pathSegments: FolderPathSegment[],
  fileName: string,
  supplierCandidates: Array<{ id: number; supplier_code: string | null; supplier_name: string }>
): { supplierId: number | null; inferredCode: string | null; inferredName: string | null } {
  const normalizedFileName = normalizeSupplierKey(fileName);
  const segments = [...pathSegments].reverse();

  for (const segment of segments) {
    const normalizedSegment = normalizeSupplierKey(segment.name);
    const matched = supplierCandidates.find((supplier) => {
      const code = normalizeSupplierKey(supplier.supplier_code);
      const name = normalizeSupplierKey(supplier.supplier_name);
      return (
        (code && code === normalizedSegment) ||
        (name && name === normalizedSegment) ||
        (code && normalizedFileName.includes(code)) ||
        (name && normalizedFileName.includes(name))
      );
    });

    if (matched) {
      return {
        supplierId: matched.id,
        inferredCode: matched.supplier_code,
        inferredName: matched.supplier_name,
      };
    }
  }

  const fallbackMatch = supplierCandidates.find((supplier) => {
    const code = normalizeSupplierKey(supplier.supplier_code);
    const name = normalizeSupplierKey(supplier.supplier_name);
    return (
      (code && normalizedFileName.includes(code)) ||
      (name && normalizedFileName.includes(name))
    );
  });

  if (fallbackMatch) {
    return {
      supplierId: fallbackMatch.id,
      inferredCode: fallbackMatch.supplier_code,
      inferredName: fallbackMatch.supplier_name,
    };
  }

  return {
    supplierId: null,
    inferredCode: null,
    inferredName: null,
  };
}



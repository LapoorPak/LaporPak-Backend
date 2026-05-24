export function getStringValue(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

export const getStringQuery = getStringValue;
export const getBodyString = getStringValue;

export function getBooleanValue(value: unknown) {
  const parsed = getStringValue(value);
  if (parsed === undefined) return undefined;
  if (parsed === "true") return true;
  if (parsed === "false") return false;
  return undefined;
}

export const getBooleanQuery = getBooleanValue;

export function getNumberValue(value: unknown) {
  if (value == null) return undefined;

  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const getNumberQuery = getNumberValue;

export function getStringArray(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [trimmed];
    }
  }

  return [trimmed];
}

export function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [trimmed];
    }
  }

  return [trimmed];
}

export function getUploadedFiles(files: unknown) {
  return Array.isArray(files)
    ? files.filter((file): file is Express.Multer.File => Boolean(file?.buffer))
    : [];
}

export function buildAiImageInputs(files: Express.Multer.File[], paths: string[]) {
  return files
    .map((file, index) => ({
      path: paths[index],
      buffer: file.buffer,
      mimeType: file.mimetype,
      size: file.size,
    }))
    .filter((item) => Boolean(item.path));
}

import cloudinaryPkg from "cloudinary";

const { v2: cloudinary } = cloudinaryPkg;

function getConfigured() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

/**
 * Extracts the Cloudinary public_id from a res.cloudinary.com URL.
 * Handles optional version segments (e.g. /v1718000000/).
 * Returns null if the URL is not a valid Cloudinary URL.
 */
export function extractPublicId(url: string): { publicId: string; resourceType: "image" | "video" } | null {
  if (!url?.includes("res.cloudinary.com")) return null;

  const parts = url.split("/");
  const uploadIdx = parts.indexOf("upload");
  if (uploadIdx === -1) return null;

  let after = parts.slice(uploadIdx + 1);
  if (after[0] && /^v\d+$/.test(after[0])) after = after.slice(1);

  const publicIdWithExt = after.join("/");
  if (!publicIdWithExt) return null;

  const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf("."));
  const resourceType = url.includes("/video/") ? "video" : "image";

  return { publicId, resourceType };
}

/**
 * Deletes one or more Cloudinary assets by URL.
 * Fire-and-forget — errors are logged but never thrown.
 */
export function deleteCloudinaryUrls(urls: string[]): void {
  const validUrls = urls.filter((u) => u?.includes("res.cloudinary.com"));
  if (validUrls.length === 0) return;

  const cld = getConfigured();

  Promise.allSettled(
    validUrls.map(async (url) => {
      const extracted = extractPublicId(url);
      if (!extracted) return;
      const { publicId, resourceType } = extracted;
      const result = await cld.uploader.destroy(publicId, { resource_type: resourceType });
      if (result.result !== "ok") {
        console.warn(`Cloudinary delete skipped for ${publicId}: ${result.result}`);
      }
    })
  ).catch((err) => console.error("Cloudinary bulk delete error:", err));
}

/**
 * Diffs old vs new image arrays and deletes removed Cloudinary URLs.
 * Use before a product update to clean up replaced images.
 */
export function deleteRemovedImages(
  old: { imageUrl?: string | null; images?: string[] | null; videoUrl?: string | null },
  next: { imageUrl?: string; images?: string[]; videoUrl?: string }
): void {
  const toDelete: string[] = [];

  if (next.imageUrl !== undefined && next.imageUrl !== old.imageUrl && old.imageUrl) {
    toDelete.push(old.imageUrl);
  }

  if (next.videoUrl !== undefined && next.videoUrl !== old.videoUrl && old.videoUrl) {
    toDelete.push(old.videoUrl);
  }

  if (next.images !== undefined && Array.isArray(old.images)) {
    const newSet = new Set(next.images);
    for (const img of old.images) {
      if (img && !newSet.has(img)) toDelete.push(img);
    }
  }

  deleteCloudinaryUrls(toDelete);
}

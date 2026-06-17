export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
export const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'

/** Returns whether the file type string represents an image. */
export function isImage(fileType) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((fileType ?? '').toLowerCase())
}

/** Returns a human-readable label for a file type string. */
export function fileTypeLabel(fileType) {
  if (!fileType) return 'Unknown'
  const map = { pdf: 'PDF', jpg: 'JPEG Image', jpeg: 'JPEG Image', png: 'PNG Image', gif: 'GIF Image', webp: 'WebP Image' }
  return map[fileType.toLowerCase()] ?? fileType.toUpperCase()
}

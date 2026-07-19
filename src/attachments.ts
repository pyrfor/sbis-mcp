export type AttachmentDownload = {
  url: string
  contentType: string
  data: ArrayBuffer
  size: number
}

export type AttachmentFetcher = (url: string) => Promise<AttachmentDownload>

let attachmentFetcherOverride: AttachmentFetcher | null = null

export function setAttachmentFetcher(fn: AttachmentFetcher | null): void {
  attachmentFetcherOverride = fn
}

async function defaultFetch(url: string): Promise<AttachmentDownload> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) })
  if (!res.ok) {
    throw new Error(`Attachment download failed: HTTP ${res.status}`)
  }
  const data = await res.arrayBuffer()
  return {
    url,
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    data,
    size: data.byteLength,
  }
}

/** Download attachment by temporary URL (no sid header — link is self-contained). */
export async function downloadAttachment(url: string): Promise<AttachmentDownload> {
  const fetcher = attachmentFetcherOverride ?? defaultFetch
  return fetcher(url)
}

export function attachmentToBase64(download: AttachmentDownload): string {
  return Buffer.from(download.data).toString('base64')
}

export async function attachmentSha256(download: AttachmentDownload): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', download.data)
  return Buffer.from(hash).toString('hex')
}

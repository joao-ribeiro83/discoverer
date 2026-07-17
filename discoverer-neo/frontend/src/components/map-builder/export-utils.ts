// Result-preview (Excel/CSV) export used to be computed client-side here, but
// only ever had the last *preview* (max 1000 rows) in memory, not the true
// full result set. That path is superseded by the server-side export flow
// (`useMapExport`, `POST /api/maps/:id/export`) — this file now only holds
// generic download/filename helpers, plus the still-real client-side XML
// (map definition) export.

function triggerDownload(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function safeFilename(name: string): string {
  const base = name.trim().replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '')
  return base || 'map'
}

/** Trigger a save-as download for a Blob already fetched from the server (e.g. a data export file). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadXml(xml: string, mapName: string) {
  triggerDownload(xml, `${safeFilename(mapName)}.xml`, 'application/xml;charset=utf-8')
}

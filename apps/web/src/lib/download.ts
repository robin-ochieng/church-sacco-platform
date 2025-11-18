export function saveBlob(blob: Blob, filename: string) {
  if (typeof window === 'undefined') {
    throw new Error('saveBlob must be executed in a browser context');
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function buildDownloadFilename(prefix: string, identifier: string) {
  const datePart = new Date().toISOString().split('T')[0];
  return `${prefix}-${identifier}-${datePart}.pdf`;
}

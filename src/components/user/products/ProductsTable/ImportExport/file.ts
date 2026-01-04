export async function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  await downloadBlob(blob, filename);
}

export async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


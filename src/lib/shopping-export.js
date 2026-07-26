// Client-side shopping-list export helpers.
// Both helpers render the LIVE DOM element via html2canvas, so the output
// preserves exactly what the user sees on screen — including Arabic text,
// RTL layout, and the current language — with no transliteration issues.

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const CAPTURE_OPTIONS = {
  scale: 2,
  backgroundColor: '#ffffff',
  useCORS: true,
};

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/**
 * Export a DOM element as a PNG image download.
 * @param {HTMLElement} element
 * @param {string} filename e.g. "shopping-list.png"
 */
export async function exportListAsImage(element, filename) {
  const canvas = await html2canvas(element, CAPTURE_OPTIONS);
  triggerDownload(canvas.toDataURL('image/png'), filename);
}

/**
 * Export a DOM element as an A4 portrait PDF.
 * The rendered canvas is sliced into page-height chunks so long lists span
 * multiple pages without distortion.
 * @param {HTMLElement} element
 * @param {string} filename e.g. "shopping-list.pdf"
 */
export async function exportListAsPDF(element, filename) {
  const canvas = await html2canvas(element, CAPTURE_OPTIONS);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Fit the full canvas width to the page width.
  const imgWidthMm = pageWidth;
  const pxPerMm = canvas.width / imgWidthMm;
  const pageHeightPx = Math.floor(pageHeight * pxPerMm);

  let offset = 0;
  let pageIndex = 0;
  while (offset < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offset);

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    const sliceHeightMm = sliceHeight / pxPerMm;
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, imgWidthMm, sliceHeightMm);

    offset += sliceHeight;
    pageIndex += 1;
  }

  pdf.save(filename);
}

// Client-side shopping-list export rendered manually on a <canvas>.
//
// Why not html2canvas: html2canvas re-shapes text itself and garbles Arabic
// (broken ligatures, overlapping letters in headers). Canvas fillText uses
// the browser's native text-shaping engine, so Arabic renders with correct
// ligatures, kerning, and RTL layout — identical to on-screen text.
//
// API:
//   exportListAsImage(data, filename)  → PNG download
//   exportListAsPDF(data, filename)    → A4 multi-page PDF download
//
// `data` shape:
// {
//   title, subtitle,                    // header strings (localized)
//   shoppedLabel, ofLabel,              // "تم التسوق" / "من"
//   done, total, progress,              // numbers (progress = 0..100)
//   categories: [{ key, label, items: [{ name, quantity, checked }] }],
//   footer                              // small centered attribution line
// }

import { jsPDF } from 'jspdf';

const SCALE = 2;          // render at 2x for crisp output
const W = 1000;           // logical width
const PAD = 48;
const CARD_PAD = 26;
const CARD_GAP = 22;
const HEADER_H = 196;
const FOOTER_H = 72;
const CAT_HEADER_H = 60;
const ITEM_H = 56;

const COLORS = {
  pageBg: '#F5F6F2',
  cardBg: '#FFFFFF',
  border: '#E6E8E2',
  divider: '#F0F1EC',
  title: '#152A1E',
  body: '#22332A',
  muted: '#7C877F',
  accent: '#15803D',
  track: '#EBEDE7',
  checked: '#9AA69E',
};

// Category → tile emoji + soft tile background + accent color
const CATEGORY_STYLE = {
  meat_protein:      { emoji: '🥩', tile: '#FDECEC', bar: '#DC2626' },
  vegetables_fruits: { emoji: '🥬', tile: '#E9F6EC', bar: '#16A34A' },
  dairy:             { emoji: '🧀', tile: '#FDF4E0', bar: '#D97706' },
  grains_legumes:    { emoji: '🍞', tile: '#FBF0DC', bar: '#B45309' },
  oils_spices:       { emoji: '🧴', tile: '#FCEFE3', bar: '#EA580C' },
  drinks:            { emoji: '🥤', tile: '#E3F2FB', bar: '#0284C7' },
  other:             { emoji: '🛒', tile: '#EFF1EE', bar: '#64748B' },
};

const FONT = '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif';

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load(`700 40px ${FONT}`),
      document.fonts.load(`600 26px ${FONT}`),
      document.fonts.load(`500 22px ${FONT}`),
      document.fonts.load(`400 20px ${FONT}`),
    ]);
    await document.fonts.ready;
  } catch {
    // Font loading failed — canvas falls back to system fonts, still fine.
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function measureHeight(data) {
  let h = PAD + HEADER_H;
  for (const cat of data.categories) {
    h += CARD_PAD * 2 + CAT_HEADER_H + 8 + cat.items.length * ITEM_H + CARD_GAP;
  }
  h += FOOTER_H + PAD;
  return h;
}

function draw(data) {
  const logicalH = measureHeight(data);
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = logicalH * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'middle';

  // Page background
  ctx.fillStyle = COLORS.pageBg;
  ctx.fillRect(0, 0, W, logicalH);

  const right = W - PAD; // RTL anchor: all primary text right-aligned here

  // ---------- Header ----------
  let y = PAD + 8;

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.title;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(data.title, right, y + 22);
  y += 52;

  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 21px ${FONT}`;
  ctx.fillText(data.subtitle, right, y + 14);
  y += 44;

  // Progress row: label (right) + percentage (left)
  ctx.fillStyle = COLORS.body;
  ctx.font = `500 22px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${data.shoppedLabel}: ${data.done} ${data.ofLabel} ${data.total}`, right, y + 12);
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.accent;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(`${data.progress}%`, PAD, y + 12);
  y += 32;

  // Progress track + fill (fills from the right in RTL)
  const trackW = W - PAD * 2;
  ctx.fillStyle = COLORS.track;
  roundRect(ctx, PAD, y, trackW, 12, 6);
  ctx.fill();
  if (data.progress > 0) {
    const fillW = Math.max(12, (trackW * data.progress) / 100);
    ctx.fillStyle = COLORS.accent;
    roundRect(ctx, PAD + trackW - fillW, y, fillW, 12, 6);
    ctx.fill();
  }

  // ---------- Category cards ----------
  y = PAD + HEADER_H;

  for (const cat of data.categories) {
    const style = CATEGORY_STYLE[cat.key] || CATEGORY_STYLE.other;
    const cardH = CARD_PAD * 2 + CAT_HEADER_H + 8 + cat.items.length * ITEM_H;
    const cardX = PAD;
    const cardW = W - PAD * 2;

    ctx.fillStyle = COLORS.cardBg;
    roundRect(ctx, cardX, y, cardW, cardH, 20);
    ctx.fill();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    const cardRight = cardX + cardW - CARD_PAD;
    let cy = y + CARD_PAD;

    // Category tile (emoji on soft colored square, at the right edge)
    const tileSize = 46;
    const tileX = cardRight - tileSize;
    const tileY = cy + (CAT_HEADER_H - tileSize) / 2;
    ctx.fillStyle = style.tile;
    roundRect(ctx, tileX, tileY, tileSize, tileSize, 13);
    ctx.fill();
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.font = `400 26px ${FONT}`;
    ctx.fillText(style.emoji, tileX + tileSize / 2, tileY + tileSize / 2 + 1);

    // Category label (right-aligned, left of the tile)
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.title;
    ctx.font = `700 27px ${FONT}`;
    ctx.fillText(cat.label, tileX - 16, cy + CAT_HEADER_H / 2);

    // Item count chip (left side)
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillStyle = COLORS.muted;
    ctx.font = `500 18px ${FONT}`;
    ctx.fillText(`${cat.items.length}`, cardX + CARD_PAD, cy + CAT_HEADER_H / 2);

    // Accent underline beneath the category header
    cy += CAT_HEADER_H + 4;
    ctx.fillStyle = style.bar;
    roundRect(ctx, cardRight - 72, cy, 72, 4, 2);
    ctx.fill();
    cy += 4;

    // ---------- Items ----------
    cat.items.forEach((item, idx) => {
      const rowY = cy + idx * ITEM_H;
      const midY = rowY + ITEM_H / 2;

      // Divider between rows
      if (idx > 0) {
        ctx.strokeStyle = COLORS.divider;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cardX + CARD_PAD, rowY);
        ctx.lineTo(cardRight, rowY);
        ctx.stroke();
      }

      // Checkbox circle at the right
      const cx = cardRight - 14;
      if (item.checked) {
        ctx.fillStyle = COLORS.accent;
        ctx.beginPath();
        ctx.arc(cx, midY, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(cx - 4.6, midY + 0.2);
        ctx.lineTo(cx - 1.2, midY + 3.6);
        ctx.lineTo(cx + 5, midY - 3.4);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#B9C2BB';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, midY, 11, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Item name (right-aligned after the circle)
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = `500 22px ${FONT}`;
      ctx.fillStyle = item.checked ? COLORS.checked : COLORS.body;
      const nameX = cx - 24;
      ctx.fillText(item.name, nameX, midY);

      // Strikethrough for checked items
      if (item.checked) {
        const nameW = ctx.measureText(item.name).width;
        ctx.strokeStyle = COLORS.checked;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(nameX - nameW, midY);
        ctx.lineTo(nameX, midY);
        ctx.stroke();
      }

      // Quantity chip (left side)
      ctx.direction = 'rtl';
      ctx.textAlign = 'left';
      ctx.font = `400 19px ${FONT}`;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(item.quantity, cardX + CARD_PAD, midY);
    });

    y += cardH + CARD_GAP;
  }

  // ---------- Footer ----------
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.font = `400 17px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(data.footer, W / 2, y + FOOTER_H / 2 - 6);

  return canvas;
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/**
 * Render the shopping list to a canvas and download it as a PNG image.
 * @param {object} data structured list data (see top of file)
 * @param {string} filename e.g. "shopping-list.png"
 */
export async function exportListAsImage(data, filename) {
  await ensureFonts();
  const canvas = draw(data);
  triggerDownload(canvas.toDataURL('image/png'), filename);
}

/**
 * Render the shopping list and download it as an A4 portrait PDF.
 * The tall canvas is sliced into page-height chunks so long lists span
 * multiple pages without distortion. Pages are raster images, which keeps
 * Arabic text pixel-perfect (jsPDF's text API cannot shape Arabic).
 * @param {object} data structured list data (see top of file)
 * @param {string} filename e.g. "shopping-list.pdf"
 */
export async function exportListAsPDF(data, filename) {
  await ensureFonts();
  const canvas = draw(data);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const marginMm = 6;
  const imgWidthMm = pageWidth - marginMm * 2;
  const pxPerMm = canvas.width / imgWidthMm;
  const pageHeightPx = Math.floor((pageHeight - marginMm * 2) * pxPerMm);

  let offset = 0;
  let pageIndex = 0;
  while (offset < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offset);

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = COLORS.pageBg;
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    const sliceHeightMm = sliceHeight / pxPerMm;
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', marginMm, marginMm, imgWidthMm, sliceHeightMm);

    offset += sliceHeight;
    pageIndex += 1;
  }

  pdf.save(filename);
}

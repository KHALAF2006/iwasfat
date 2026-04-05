import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { shopping_list_id } = await req.json();
  if (!shopping_list_id) return Response.json({ error: 'shopping_list_id required' }, { status: 400 });

  const list = await base44.asServiceRole.entities.ShoppingList.get(shopping_list_id);
  if (!list) return Response.json({ error: 'List not found' }, { status: 404 });

  const CATEGORIES = {
    meat_protein: '🥩 اللحوم والبروتين',
    vegetables_fruits: '🥦 الخضروات والفواكه',
    dairy: '🧀 الألبان والأجبان',
    grains_legumes: '🌾 الحبوب والبقوليات',
    oils_spices: '🧴 الزيوت والتوابل',
    drinks: '🥤 المشروبات',
    other: '🛒 أخرى'
  };

  const CAT_ORDER = ['meat_protein','vegetables_fruits','dairy','grains_legumes','oils_spices','drinks','other'];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(42, 85, 60);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('Shopping List', 105, 15, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Week: ${list.week_start_date}`, 105, 23, { align: 'center' });

  const checked = list.items.filter(i => i.is_checked).length;
  const total = list.items.length;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Total Items: ${total}  |  Purchased: ${checked}  |  Remaining: ${total - checked}`, 105, 38, { align: 'center' });

  let y = 48;

  const grouped = {};
  for (const item of list.items) {
    const cat = item.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  for (const catKey of CAT_ORDER) {
    if (!grouped[catKey] || grouped[catKey].length === 0) continue;

    if (y > 260) { doc.addPage(); y = 20; }

    // Category header
    doc.setFillColor(240, 247, 243);
    doc.rect(10, y - 4, 190, 8, 'F');
    doc.setFontSize(11);
    doc.setTextColor(42, 85, 60);
    doc.text(CATEGORIES[catKey] || catKey, 15, y + 1);
    y += 10;

    for (const item of grouped[catKey]) {
      if (y > 270) { doc.addPage(); y = 20; }

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);

      // Checkbox
      doc.setDrawColor(100, 100, 100);
      doc.rect(14, y - 3.5, 4, 4);
      if (item.is_checked) {
        doc.setDrawColor(42, 85, 60);
        doc.line(14, y - 1, 15.5, y + 0.5);
        doc.line(15.5, y + 0.5, 18, y - 3);
      }

      doc.setTextColor(item.is_checked ? 150 : 0, item.is_checked ? 150 : 0, item.is_checked ? 150 : 0);
      doc.text(item.item_name, 22, y);
      doc.text(item.quantity, 150, y, { align: 'left' });

      if (item.is_checked) {
        doc.setDrawColor(150, 150, 150);
        doc.line(22, y - 0.5, 22 + doc.getTextWidth(item.item_name), y - 0.5);
      }

      y += 8;
    }
    y += 3;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
  }

  const pdfBytes = doc.output('arraybuffer');
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=shopping-list-${list.week_start_date}.pdf`
    }
  });
});
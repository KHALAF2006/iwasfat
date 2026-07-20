import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

// SECURITY: ownership check — callers may only export their OWN shopping list.
// The caller's Subscriber is resolved via created_by == auth email; admins bypass.

// PDF LIMITATION: jsPDF's bundled fonts cannot shape Arabic script (output is
// garbled). The pragmatic fix is an English-export PDF: English labels and a
// deterministic Arabic->Latin transliteration for item names. The UI presents
// this as "English PDF export". A proper fix would embed a base64 Arabic font,
// which is not feasible here without multi-hundred-KB payloads per function.

const AR_LAT = {
  'ا':'a','أ':'a','إ':'i','آ':'a','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
  'د':'d','ذ':'th','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z',
  'ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w',
  'ي':'y','ى':'a','ة':'a','ء':'\'','ؤ':'u','ئ':'i','لا':'la',
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
  '،':',','؟':'?','؛':';'
};

function transliterate(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // strip harakat/tatweel
    .split('')
    .map(ch => AR_LAT[ch] !== undefined ? AR_LAT[ch] : (ch.charCodeAt(0) < 128 ? ch : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

const CATEGORIES = {
  meat_protein: 'Meat & Protein',
  vegetables_fruits: 'Vegetables & Fruits',
  dairy: 'Dairy & Cheese',
  grains_legumes: 'Grains & Legumes',
  oils_spices: 'Oils & Spices',
  drinks: 'Drinks',
  other: 'Other'
};

const CAT_ORDER = ['meat_protein','vegetables_fruits','dairy','grains_legumes','oils_spices','drinks','other'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { shopping_list_id } = await req.json();
    if (!shopping_list_id) return Response.json({ error: 'shopping_list_id required' }, { status: 400 });

    const list = await base44.asServiceRole.entities.ShoppingList.get(shopping_list_id);
    if (!list) return Response.json({ error: 'List not found' }, { status: 404 });

    // IDOR fix: verify the caller owns this list (or is an admin)
    if (user.role !== 'admin') {
      const own = await base44.asServiceRole.entities.Subscriber.filter({ created_by: user.email });
      const mySubscriber = own[0];
      if (!mySubscriber || mySubscriber.id !== list.subscriber_id) {
        return Response.json({ error: 'Forbidden: not your shopping list' }, { status: 403 });
      }
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header
    doc.setFillColor(42, 85, 60);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Shopping List (English Export)', 105, 15, { align: 'center' });
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

        const name = transliterate(item.item_name) || 'item';
        const qty = transliterate(item.quantity) || '';

        doc.setTextColor(item.is_checked ? 150 : 0, item.is_checked ? 150 : 0, item.is_checked ? 150 : 0);
        doc.text(name, 22, y);
        doc.text(qty, 150, y, { align: 'left' });

        if (item.is_checked) {
          doc.setDrawColor(150, 150, 150);
          doc.line(22, y - 0.5, 22 + doc.getTextWidth(name), y - 0.5);
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
      doc.text(`Page ${i} of ${pageCount}  |  Arabic names transliterated to Latin script`, 105, 290, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=shopping-list-${list.week_start_date}-en.pdf`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

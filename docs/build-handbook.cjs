// Usage (repo root): node docs/build-handbook.cjs   — needs the docx dev dependency.
// Afterwards, open it in Word and update fields (right-click the contents -> Update Field) for page numbers.
// Builds NGX-Tracker-Handbook.docx from the repo's docs/*.md (the subset of Markdown they use).
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, AlignmentType, LevelFormat, ExternalHyperlink, TableOfContents, PageBreak, Footer, PageNumber,
} = require('docx');

const DOCS = process.argv[2] || __dirname;
const OUT = process.argv[3] || path.join(__dirname, 'NGX-Tracker-Handbook.docx');
const PARTS = [
  ['README.md', 'Overview'],
  ['user-guide.md', 'Using the site'],
  ['owner-guide.md', "Owner's guide"],
  ['developer-guide.md', 'Developer guide'],
];
const GREEN = '1C7A4A';
const MUTED = '5A6A60';
const RULE = 'D8E2DB';
const CODE_BG = 'EEF3EF';
const CONTENT_W = 9360; // US Letter, 1" margins

// ---------- inline: **bold**, *italic*, `code`, [text](url) ----------
function inline(text, base = {}) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(\*([^*]+)\*)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    if (m[1]) out.push(...inline(m[2], { ...base, bold: true }));
    else if (m[3]) out.push(new TextRun({ text: m[4], font: 'Consolas', size: 19, shading: { type: ShadingType.CLEAR, color: 'auto', fill: CODE_BG }, ...base }));
    else if (m[5]) {
      const label = m[6], url = m[7];
      if (/^https?:/.test(url)) out.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: label, style: 'Hyperlink', ...base })] }));
      else out.push(...inline(label, base)); // links between the Markdown files: plain text in the handbook
    } else if (m[8]) out.push(new TextRun({ text: m[9], italics: true, ...base }));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: RULE };
function table(rows) {
  const cols = Math.max(...rows.map((r) => r.length));
  const lens = Array.from({ length: cols }, (_, c) => Math.max(6, ...rows.map((r) => (r[c] || '').replace(/[*`]/g, '').length)));
  const capped = lens.map((l) => Math.min(l, 60));
  const sum = capped.reduce((a, b) => a + b, 0);
  const widths = capped.map((l) => Math.floor((l / sum) * CONTENT_W));
  widths[widths.length - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((r, ri) => new TableRow({
      tableHeader: ri === 0,
      children: Array.from({ length: cols }, (_, c) => new TableCell({
        width: { size: widths[c], type: WidthType.DXA },
        borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
        shading: ri === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: CODE_BG } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: inline(r[c] || '', ri === 0 ? { bold: true, size: 19, color: MUTED } : { size: 19 }) })],
      })),
    })),
  });
}

function codeBlock(lines) {
  return lines.map((l, i) => new Paragraph({
    spacing: { before: i === 0 ? 80 : 0, after: i === lines.length - 1 ? 160 : 0, line: 240 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: CODE_BG },
    children: [new TextRun({ text: l.length ? l : ' ', font: 'Consolas', size: 16 })],
  }));
}

let listInstance = 0;
function convert(md, title) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  let para = [];
  const flush = () => {
    if (para.length) { out.push(new Paragraph({ children: inline(para.join(' ')) })); para = []; }
  };
  let ordered = null;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(...codeBlock(buf));
      continue;
    }
    if (/^\|/.test(line)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      out.push(table(rows));
      out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
      continue;
    }
    let m;
    if ((m = /^(#{1,3}) (.*)$/.exec(line))) {
      flush();
      const level = m[1].length;
      if (level === 1) {
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(title)] }));
      } else {
        out.push(new Paragraph({ heading: level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: inline(m[2]) }));
      }
      i++;
      continue;
    }
    if ((m = /^\s*- (.*)$/.exec(line))) {
      flush();
      out.push(new Paragraph({ numbering: { reference: 'bullets', level: /^\s{2,}/.test(line) ? 1 : 0 }, children: inline(m[1]) }));
      i++;
      continue;
    }
    if ((m = /^(\d+)\. (.*)$/.exec(line))) {
      flush();
      if (m[1] === '1') ordered = ++listInstance;
      out.push(new Paragraph({ numbering: { reference: 'numbers', level: 0, instance: ordered }, children: inline(m[2]) }));
      i++;
      continue;
    }
    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    para.push(line.trim());
    i++;
  }
  flush();
  return out;
}

const body = [];
for (const [file, title] of PARTS) body.push(...convert(fs.readFileSync(path.join(DOCS, file), 'utf8'), title));

const cover = [
  new Paragraph({ spacing: { before: 2400, after: 120 }, children: [new TextRun({ text: 'NIGERIAN EXCHANGE · PRIVATE TRACKER', size: 20, color: GREEN, bold: true, characterSpacing: 40 })] }),
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: 'NGX Tracker Handbook', size: 64, bold: true, color: '15211A' })] }),
  new Paragraph({ spacing: { after: 480 }, children: [new TextRun({ text: 'How the private NGX stock tracker works, how to use it, how to look after it, and how it is built.', size: 26, color: MUTED })] }),
  new Paragraph({ children: [new TextRun({ text: 'Site: ngx-tracker.pages.dev (sign-in required)', size: 22 })] }),
  new Paragraph({ children: [new TextRun({ text: 'Code: github.com/donne4real/ngx-tracker (private)', size: 22 })] }),
  new Paragraph({ children: [new TextRun({ text: 'Written 25 September 2026, for the version live that day', size: 22, color: MUTED })] }),
  new Paragraph({ children: [new PageBreak()] }),
  // Styled like a heading but not one, so the contents page doesn't list itself.
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Contents', size: 36, bold: true, color: '15211A' })] }),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
];

const doc = new Document({
  creator: 'NGX Tracker',
  title: 'NGX Tracker Handbook',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21 }, paragraph: { spacing: { after: 120, line: 276 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true, color: '15211A', font: 'Calibri' }, paragraph: { spacing: { before: 0, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, color: GREEN, font: 'Calibri' }, paragraph: { spacing: { before: 320, after: 100 }, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, color: '15211A', font: 'Calibri' }, paragraph: { spacing: { before: 220, after: 80 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 240 } } } },
      ] },
      { reference: 'numbers', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 300 } } } },
      ] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ text: 'NGX Tracker Handbook · page ', size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED }),
      ] })] }),
    },
    children: [...cover, ...body],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('wrote', OUT, buf.length, 'bytes'); });

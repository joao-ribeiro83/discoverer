#!/usr/bin/env node
/**
 * Builds the role manuals (Word) from markdown sources.
 *
 *   docs/user-guide/manual/src/{locale}/{ROLE}-{full|quick}.md
 *     -> docs/user-guide/manual/Discoverer-Neo-{ROLE}-Guide-{Full|Quick}-{locale}.docx
 *
 * Needs the `docx` npm package, which is not a project dependency:
 *   npm i --no-save docx@9   (or point NODE_PATH at a folder that has it)
 *
 * Usage: node scripts/build-manuals.cjs [ROLE ...]   (MANUAL_LOCALES=en,pt-PT to limit languages)
 *
 * Markdown subset: # / ## / ### headings, paragraphs with **bold** *italic*
 * `code`, "- " bullets (two-space indent = level 2), "1. " numbered lists,
 * pipe tables, "![caption](shots/<locale>/file.png)" images, "> " blocks
 * (tip / note / warning boxes), and "---" for a page break.
 * The table of contents is a Word field; scripts/update-docx-fields.ps1 fills it.
 */
const fs = require('fs');
const path = require('path');
const d = require('docx');

const ROOT = path.resolve(__dirname, '..');
const MANUAL = path.join(ROOT, 'docs/user-guide/manual');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const LOCALES = process.env.MANUAL_LOCALES ? process.env.MANUAL_LOCALES.split(',') : ['en', 'pt-PT', 'es-ES', 'fr-FR'];
const ROLES = ['ADMIN', 'MANAGER', 'USER', 'VIEWER'];
const KINDS = ['full', 'quick'];

const NAVY = '1F3A5F';
const ACCENT = '2E6DA4';
const FONT = 'Calibri';
const CONTENT_WIDTH = 9026; // A4 minus 1" margins, DXA
const MAX_IMG_PX = 600; // ~6.25"

const COVER = {
  en: { full: 'Complete guide', quick: 'Quick guide', role: 'For the {role} role', toc: 'Contents', page: 'Page', version: 'Version' },
  'pt-PT': { full: 'Guia completo', quick: 'Guia rápido', role: 'Para a função {role}', toc: 'Índice', page: 'Página', version: 'Versão' },
  'es-ES': { full: 'Guía completa', quick: 'Guía rápida', role: 'Para el rol {role}', toc: 'Índice', page: 'Página', version: 'Versión' },
  'fr-FR': { full: 'Guide complet', quick: 'Guide rapide', role: 'Pour le rôle {role}', toc: 'Sommaire', page: 'Page', version: 'Version' },
};

const BOX = {
  tip: { fill: 'E8F4EA', border: '4E9A5B' },
  note: { fill: 'E8F0F8', border: ACCENT },
  warning: { fill: 'FDF1E3', border: 'D08A2E' },
};

// --- inline markdown -------------------------------------------------------
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(new d.TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new d.TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else if (t.startsWith('`')) out.push(new d.TextRun({ text: t.slice(1, -1), font: 'Consolas', size: 19, ...base }));
    else out.push(new d.TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new d.TextRun({ text: text.slice(last), ...base }));
  return out;
}

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// --- block markdown --------------------------------------------------------
function parse(md, locale) {
  const lines = md.replace(/\r/g, '').split('\n');
  const blocks = [];
  // Spacers and "---" breaks are dropped before a chapter, which starts its own
  // page anyway; left in, one that spills over a full page makes a blank page.
  const spacers = new Set();
  const spacer = (p) => { spacers.add(p); blocks.push(p); };
  let i = 0;
  const cellBorder = { style: d.BorderStyle.SINGLE, size: 4, color: 'BFC7D1' };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(/^(#{1,3}) (.*)$/))) {
      const level = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3][m[1].length - 1];
      if (m[1].length === 1) while (blocks.length && spacers.has(blocks[blocks.length - 1])) blocks.pop();
      blocks.push(new d.Paragraph({ heading: level, children: runs(m[2]), pageBreakBefore: m[1].length === 1 && blocks.length > 0 }));
      i++;
    } else if (line.trim() === '---') {
      spacer(new d.Paragraph({ children: [new d.PageBreak()] }));
      i++;
    } else if ((m = line.match(/^!\[(.*)\]\((.*)\)\s*$/))) {
      const file = path.join(MANUAL, m[2]);
      if (!fs.existsSync(file)) throw new Error(`missing image ${m[2]}`);
      const buf = fs.readFileSync(file);
      let { w, h } = pngSize(buf);
      // Shots are taken at 1.5x; /2.2 keeps a cropped dialog at a readable, not page-filling, size.
      const scale = Math.min(1 / 2.2, MAX_IMG_PX / w, 620 / h);
      blocks.push(new d.Paragraph({
        alignment: d.AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
        children: [new d.ImageRun({ type: 'png', data: buf, transformation: { width: Math.round(w * scale), height: Math.round(h * scale) }, altText: { title: m[1], description: m[1], name: path.basename(file) } })],
      }));
      if (m[1]) blocks.push(new d.Paragraph({ style: 'Caption', alignment: d.AlignmentType.CENTER, children: runs(m[1]) }));
      i++;
    } else if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      const cols = rows[0].length;
      // Column width follows the longest text in it, floored so no column is squeezed.
      const len = [...Array(cols)].map((_, c) => Math.max(8, Math.min(60, ...rows.map((r) => (r[c] || '').length))));
      const total = len.reduce((a, b) => a + b, 0);
      const widths = len.map((l) => Math.floor((CONTENT_WIDTH * l) / total));
      widths[cols - 1] += CONTENT_WIDTH - widths.reduce((a, b) => a + b, 0);
      blocks.push(new d.Table({
        width: { size: CONTENT_WIDTH, type: d.WidthType.DXA },
        columnWidths: widths,
        rows: rows.map((cells, r) => new d.TableRow({
          tableHeader: r === 0,
          cantSplit: true,
          children: widths.map((wd, c) => new d.TableCell({
            width: { size: wd, type: d.WidthType.DXA },
            borders,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            shading: r === 0 ? { type: d.ShadingType.CLEAR, fill: NAVY, color: 'auto' } : (r % 2 === 0 ? { type: d.ShadingType.CLEAR, fill: 'F3F6F9', color: 'auto' } : undefined),
            children: [new d.Paragraph({ spacing: { after: 0 }, children: runs(cells[c] || '', r === 0 ? { bold: true, color: 'FFFFFF' } : {}) })],
          })),
        })),
      }));
      spacer(new d.Paragraph({ spacing: { after: 60 }, children: [] }));
    } else if (line.startsWith('>')) {
      const body = [];
      while (i < lines.length && lines[i].startsWith('>')) { body.push(lines[i].replace(/^>\s?/, '')); i++; }
      const text = body.join(' ').trim();
      const kind = /^\*\*(warning|atenção|advertencia|attention|aviso)/i.test(text) ? 'warning'
        : /^\*\*(tip|dica|consejo|astuce|conseil)/i.test(text) ? 'tip' : 'note';
      const bx = BOX[kind];
      blocks.push(new d.Paragraph({
        children: runs(text),
        shading: { type: d.ShadingType.CLEAR, fill: bx.fill, color: 'auto' },
        border: { left: { style: d.BorderStyle.SINGLE, size: 24, color: bx.border, space: 8 } },
        indent: { left: 200, right: 200 },
        spacing: { before: 120, after: 160 },
      }));
    } else if ((m = line.match(/^(\s*)(- |\d+\. )(.*)$/))) {
      const ordered = /\d/.test(m[2]);
      const ref = ordered ? `num-${blocks.length}` : 'bullets';
      if (ordered) numberingRefs.push(ref);
      while (i < lines.length && (m = lines[i].match(/^(\s*)(- |\d+\. )(.*)$/))) {
        const level = m[1].length >= 2 ? 1 : 0;
        const isNum = /\d/.test(m[2]);
        blocks.push(new d.Paragraph({ numbering: { reference: isNum ? ref : 'bullets', level }, spacing: { after: 60 }, children: runs(m[3]) }));
        i++;
      }
      spacer(new d.Paragraph({ spacing: { after: 60 }, children: [] }));
    } else {
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3} |\||>|!\[|---$|\s*- |\s*\d+\. )/.test(lines[i])) { para.push(lines[i].trim()); i++; }
      blocks.push(new d.Paragraph({ children: runs(para.join(' ')) }));
    }
  }
  return blocks;
}

let numberingRefs = [];

function build(role, kind, locale) {
  const src = path.join(MANUAL, 'src', locale, `${role}-${kind}.md`);
  if (!fs.existsSync(src)) { console.warn(`skip ${path.relative(ROOT, src)} (missing)`); return; }
  numberingRefs = [];
  const t = COVER[locale];
  const md = fs.readFileSync(src, 'utf8');
  if (md.includes('[[SHOT:')) throw new Error(`${path.relative(ROOT, src)} still has [[SHOT: …]] markers`);
  const body = parse(md, locale);
  const kindLabel = t[kind];
  const title = `Discoverer Neo`;

  const cover = [
    new d.Paragraph({ spacing: { before: 2800 }, children: [new d.TextRun({ text: title, bold: true, size: 64, color: NAVY })] }),
    new d.Paragraph({ border: { bottom: { style: d.BorderStyle.SINGLE, size: 12, color: ACCENT, space: 4 } }, spacing: { after: 240 }, children: [new d.TextRun({ text: kindLabel, size: 40, color: ACCENT })] }),
    new d.Paragraph({ children: [new d.TextRun({ text: t.role.replace('{role}', role), size: 32, bold: true })] }),
    new d.Paragraph({ spacing: { before: 2400 }, children: [new d.TextRun({ text: `${t.version} ${VERSION}`, size: 22, color: '555555' })] }),
    new d.Paragraph({ children: [new d.PageBreak()] }),
    new d.Paragraph({ style: 'TOCHeading', children: [new d.TextRun(t.toc)] }),
    new d.TableOfContents(t.toc, { hyperlink: true, headingStyleRange: '1-2' }),
  ];

  const bulletLevels = [0, 1].map((level) => ({ level, format: d.LevelFormat.BULLET, text: level ? '–' : '•', alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } } } }));
  const numLevels = [0, 1].map((level) => ({ level, format: level ? d.LevelFormat.LOWER_LETTER : d.LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 + level * 360, hanging: 300 } } } }));

  const doc = new d.Document({
    creator: 'Discoverer Neo',
    title: `${title} — ${kindLabel} — ${role}`,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { after: 120, line: 276 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, color: ACCENT }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, color: NAVY }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } },
        { id: 'Caption', name: 'Caption', basedOn: 'Normal', run: { size: 18, italics: true, color: '555555' }, paragraph: { spacing: { after: 200 } } },
        { id: 'TOCHeading', name: 'TOC Heading', basedOn: 'Normal', run: { size: 36, bold: true, color: NAVY }, paragraph: { spacing: { after: 200 } } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: bulletLevels },
        ...numberingRefs.map((reference) => ({ reference, levels: numLevels })),
      ],
    },
    sections: [
      { properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children: cover },
      {
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, pageNumbers: { start: 1 } } },
        headers: { default: new d.Header({ children: [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, children: [new d.TextRun({ text: `Discoverer Neo ${VERSION} · ${kindLabel} · ${role}`, size: 16, color: '777777' })] })] }) },
        footers: { default: new d.Footer({ children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ children: [`${t.page} `, d.PageNumber.CURRENT], size: 16, color: '777777' })] })] }) },
        children: body,
      },
    ],
  });

  const out = path.join(MANUAL, `Discoverer-Neo-${role}-Guide-${kind === 'full' ? 'Full' : 'Quick'}-${locale}.docx`);
  return d.Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log(`wrote ${path.relative(ROOT, out)}`); });
}

(async () => {
  const roles = process.argv.slice(2).length ? process.argv.slice(2) : ROLES;
  for (const role of roles) for (const kind of KINDS) for (const locale of LOCALES) await build(role, kind, locale);
})().catch((e) => { console.error(e.message); process.exit(1); });

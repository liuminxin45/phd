import type { ContactRecord } from '@/lib/contacts/types';

interface ParsedCell {
  className: string;
  id: string;
  text: string;
}

interface ContactAccumulator {
  index: number;
  name: string;
  department: string;
  phones: string[];
  locations: string[];
  emails: string[];
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<img[\s\S]*?>/gi, '')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeOptionalValue(value: string): string | null {
  const normalized = value.trim();
  if (!normalized || normalized === '----') {
    return null;
  }
  return normalized;
}

function pushUnique(target: string[], value: string | null): void {
  if (!value || target.includes(value)) {
    return;
  }
  target.push(value);
}

function parseCells(rowHtml: string): ParsedCell[] {
  const cells: ParsedCell[] = [];
  const tdRegex = /<td([^>]*)>([\s\S]*?)<\/td>/gi;
  let cellMatch: RegExpExecArray | null;

  while ((cellMatch = tdRegex.exec(rowHtml)) !== null) {
    const attrs = cellMatch[1] || '';
    const className = attrs.match(/\bclass\s*=\s*"([^"]*)"/i)?.[1]
      || attrs.match(/\bclass\s*=\s*'([^']*)'/i)?.[1]
      || '';
    const id = attrs.match(/\bid\s*=\s*"([^"]*)"/i)?.[1]
      || attrs.match(/\bid\s*=\s*'([^']*)'/i)?.[1]
      || '';
    cells.push({
      className,
      id,
      text: cleanText(cellMatch[2] || ''),
    });
  }

  return cells;
}

function buildContactKey(contact: Omit<ContactRecord, 'key'>): string {
  const primaryEmail = contact.emails[0]?.trim().toLowerCase();
  if (primaryEmail) {
    return `email:${primaryEmail}`;
  }

  const normalizedName = contact.name.trim().toLowerCase();
  if (normalizedName) {
    return `name:${normalizedName}`;
  }

  const primaryPhone = contact.phones[0]?.trim();
  return primaryPhone ? `phone:${primaryPhone}` : `row:${contact.index}`;
}

function getMainRowBlocks(tbodyHtml: string): string[] {
  const startRegex = /<tr[^>]*id\s*=\s*"(\d+)_0"[^>]*>|<tr[^>]*id\s*=\s*'(\d+)_0'[^>]*>/gi;
  const starts: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = startRegex.exec(tbodyHtml)) !== null) {
    starts.push(match.index);
  }

  if (starts.length === 0) {
    return [];
  }

  const blocks: string[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : tbodyHtml.length;
    blocks.push(tbodyHtml.slice(start, end));
  }

  return blocks;
}

export function parseContactsHtml(html: string): ContactRecord[] {
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return [];
  }

  const contactsByGroup = new Map<string, ContactAccumulator>();
  const mainRowBlocks = getMainRowBlocks(tbodyMatch[1]);

  for (const block of mainRowBlocks) {
    const trRegex = /<tr([^>]*)>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = trRegex.exec(block)) !== null) {
      const attrs = rowMatch[1] || '';
    const rowId = attrs.match(/\bid\s*=\s*"([^"]+)"/i)?.[1]
      || attrs.match(/\bid\s*=\s*'([^']+)'/i)?.[1];

      if (!rowId) {
        continue;
      }

      const idParts = rowId.split('_');
      if (idParts.length !== 2) {
        continue;
      }

      const [groupId, suffix] = idParts;
      const cells = parseCells(rowMatch[2] || '');

      if (suffix === '0') {
        const index = parseInt(cells.find((cell) => cell.className.includes('list-index'))?.text || '', 10) || 0;
        const name = cells.find((cell) => cell.className.includes('list-name'))?.text || '';
        const department = cells.find((cell) => cell.className.includes('list-department'))?.text || '';
        const phone = normalizeOptionalValue(cells.find((cell) => cell.className.includes('list-call'))?.text || '');
        const location = normalizeOptionalValue(cells.find((cell) => cell.className.includes('list-site'))?.text || '');
        const email = normalizeOptionalValue(cells.find((cell) => cell.className.includes('list-mail'))?.text || '');

        const next: ContactAccumulator = {
          index,
          name,
          department,
          phones: [],
          locations: [],
          emails: [],
        };

        pushUnique(next.phones, phone);
        pushUnique(next.locations, location);
        pushUnique(next.emails, email);

        contactsByGroup.set(groupId, next);
        continue;
      }

      const existing = contactsByGroup.get(groupId);
      if (!existing) {
        continue;
      }

      for (const cell of cells) {
        if (cell.id.endsWith('_callList')) {
          pushUnique(existing.phones, normalizeOptionalValue(cell.text));
        } else if (cell.id.endsWith('_siteList')) {
          pushUnique(existing.locations, normalizeOptionalValue(cell.text));
        } else if (cell.id.endsWith('_emailList')) {
          pushUnique(existing.emails, normalizeOptionalValue(cell.text));
        }
      }
    }
  }

  return Array.from(contactsByGroup.values())
    .map((contact) => {
      const next: Omit<ContactRecord, 'key'> = {
        index: contact.index,
        name: contact.name,
        department: contact.department,
        phones: contact.phones,
        locations: contact.locations,
        emails: contact.emails,
      };

      return {
        ...next,
        key: buildContactKey(next),
      };
    })
    .filter((contact) => contact.name)
    .sort((a, b) => a.index - b.index);
}

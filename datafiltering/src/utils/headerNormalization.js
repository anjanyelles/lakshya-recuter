export function normalizeHeaderCell(value, index) {
  const v = value == null ? '' : String(value).trim();
  return v ? v : `col_${index + 1}`;
}

export function normalizeHeaderRow(values) {
  const arr = Array.isArray(values) ? values : [];
  const header = arr.map((v, i) => normalizeHeaderCell(v, i));

  const seen = new Map();
  for (let i = 0; i < header.length; i += 1) {
    const key = header[i];
    const count = seen.get(key) || 0;
    if (count > 0) header[i] = `${key}__${count + 1}`;
    seen.set(key, count + 1);
  }

  return header;
}

export function createRowValidator({ requiredKeys = [] } = {}) {
  return function validateRow(rowObject) {
    if (!rowObject || typeof rowObject !== 'object') {
      return { ok: false, reason: 'row_not_object' };
    }

    for (const k of requiredKeys) {
      const v = rowObject[k];
      if (v == null || String(v).trim() === '') {
        return { ok: false, reason: 'missing_required', key: k };
      }
    }

    return { ok: true };
  };
}

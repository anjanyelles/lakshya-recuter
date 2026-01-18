export class SchemaMapper {
  mapRow(_row) {
    throw new Error('Not implemented');
  }
}

export class SchemaMapperFactory {
  createForHeader(_headerRow) {
    throw new Error('Not implemented');
  }
}

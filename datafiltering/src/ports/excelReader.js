export class ExcelRowStream {
  async *[Symbol.asyncIterator]() {
    throw new Error('Not implemented');
  }
}

export class ExcelReader {
  open(_filePath) {
    throw new Error('Not implemented');
  }
}

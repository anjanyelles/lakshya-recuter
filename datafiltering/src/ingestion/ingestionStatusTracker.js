export class IngestionStatusTracker {
  async ensureReady() {
    throw new Error('Not implemented');
  }

  async seedPending(_filePaths) {
    throw new Error('Not implemented');
  }

  async getStatus(_filePath) {
    throw new Error('Not implemented');
  }

  async markProcessing(_filePath, _meta = {}) {
    throw new Error('Not implemented');
  }

  async markProcessed(_filePath, _meta = {}) {
    throw new Error('Not implemented');
  }

  async markFailed(_filePath, _error, _meta = {}) {
    throw new Error('Not implemented');
  }
}

import pino from 'pino';

export function createLogger({ level, destination }) {
  const opts = {
    level,
    serializers: {
      err: pino.stdSerializers.err
    }
  };

  if (!destination) {
    return pino(opts);
  }

  return pino(opts, pino.destination({ dest: destination, sync: false }));
}

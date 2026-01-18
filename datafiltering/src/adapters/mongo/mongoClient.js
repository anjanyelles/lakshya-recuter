import { MongoClient } from 'mongodb';

export async function connectMongo({ mongodbUri }) {
  if (!mongodbUri) {
    throw new Error('Missing MONGODB_URI');
  }

  const client = new MongoClient(mongodbUri, {
    maxPoolSize: 50
  });
  await client.connect();
  return client;
}

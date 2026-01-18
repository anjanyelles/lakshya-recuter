import mongoose from 'mongoose';

export async function connectMongo({ mongodbUri }) {
  if (!mongodbUri) throw new Error('Missing MONGODB_URI');

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongodbUri);
}

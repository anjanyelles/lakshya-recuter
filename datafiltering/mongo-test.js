import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

async function test() {
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("recruitment_db");
    const result = await db.collection("candidates").insertOne({
      fullName: "Test User",
      email: "test@example.com",
      phone: "9999999999"
    });

    console.log("Inserted:", result.insertedId);
  } finally {
    await client.close();
  }
}

test().catch((err) => {
  console.error("❌ Error:", err?.message ?? err);
  process.exitCode = 1;
});

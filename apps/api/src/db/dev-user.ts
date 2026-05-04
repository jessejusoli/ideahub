import { eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";

const devUser = {
  email: "dev@ideahub.local",
  name: "IdeaHub Developer"
};

export async function getOrCreateDevUser() {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, devUser.email)
  });

  if (existing) {
    return existing;
  }

  const [created] = await db.insert(users).values(devUser).returning();

  if (!created) {
    throw new Error("Failed to create development user.");
  }

  return created;
}

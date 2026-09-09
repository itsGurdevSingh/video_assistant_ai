import { db, pool } from "./client.js";
import { users } from "./schema.js";

import { eq } from "drizzle-orm";

async function main() {
  const [user] = await db
    .insert(users)
    .values({
      name: "Gurdev",
    })
    .returning();

  console.log("Created:", user);

  const [updatedUser] = await db
    .update(users)
    .set({
      name: "Gurdev Singh",
    })
    .where(eq(users.id, user.id))
    .returning();

  console.log("Updated:", updatedUser);

  // delete user
  await db.delete(users).where(eq(users.id, user.id));

  console.log(await db.select().from(users).where(eq(users.id, user.id)));

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});

import "dotenv/config";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createTemporaryPassword } from "@/server/auth/temporary-password";
import { sendNewAccountEmail } from "@/server/email/account-email";

const input = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    displayName: z.string().trim().min(2).max(120),
  })
  .parse({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    displayName: process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME,
  });

const admin = createSupabaseAdminClient();
const temporaryPassword = createTemporaryPassword();
const created = await admin.auth.admin.createUser({
  email: input.email,
  password: temporaryPassword,
  email_confirm: true,
  user_metadata: { display_name: input.displayName },
});

if (created.error || !created.data.user) throw new Error("The Auth account could not be created.");
const authUserId = created.data.user.id;
const profile = await admin.schema("api").rpc("bootstrap_first_admin", {
  target_auth_user_id: authUserId,
  target_email: input.email,
  target_display_name: input.displayName,
});

if (profile.error) {
  await admin.auth.admin.deleteUser(authUserId);
  throw new Error("The first administrator profile could not be created.");
}

try {
  await sendNewAccountEmail({ ...input, temporaryPassword });
} catch {
  await admin.schema("api").rpc("rollback_first_admin", { target_auth_user_id: authUserId });
  await admin.auth.admin.deleteUser(authUserId);
  throw new Error("The administrator email failed; the account was rolled back.");
}

console.info(`First administrator created and credentials sent to ${input.email}.`);

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendNewAccountEmail } from "@/server/email/account-email";
import { createTemporaryPassword } from "@/server/auth/temporary-password";

type ManagedUser = {
  email: string;
  displayName: string;
  propertyId: string;
  role: "requester" | "technician" | "it_manager" | "system_administrator" | "report_viewer";
};

export async function provisionManagedUser(
  userClient: SupabaseClient,
  input: ManagedUser,
  correlationId: string,
) {
  const admin = createSupabaseAdminClient();
  const temporaryPassword = createTemporaryPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  });
  if (error || !data.user) throw new Error("ACCOUNT_CREATE_FAILED");

  const authUserId = data.user.id;
  const { error: profileError } = await userClient.schema("api").rpc("provision_user", {
    target_auth_user_id: authUserId,
    target_email: input.email,
    target_display_name: input.displayName,
    target_property_id: input.propertyId,
    target_role_key: input.role,
    request_correlation_id: correlationId,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error("PROFILE_CREATE_FAILED");
  }

  try {
    await sendNewAccountEmail({ ...input, temporaryPassword });
  } catch {
    await userClient.schema("api").rpc("remove_failed_user_provision", {
      target_auth_user_id: authUserId,
      request_correlation_id: correlationId,
    });
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error("EMAIL_SEND_FAILED");
  }
}

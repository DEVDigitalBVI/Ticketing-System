"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function MfaForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((factor) => factor.status === "verified");
      if (verified) setFactorId(verified.id);
      else {
        for (const factor of data?.totp ?? []) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
        const enrollment = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "IT Service Desk",
        });
        if (enrollment.data) {
          setFactorId(enrollment.data.id);
          setSecret(enrollment.data.totp.secret);
        } else setError(true);
      }
      setLoading(false);
    })();
  }, []);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);
    const supabase = createSupabaseBrowserClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) return setError(true);
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={verify}>
      {secret ? (
        <div className="mfa-secret">
          <strong>Add an account in your authenticator app</strong>
          <span>Setup key</span>
          <code>{secret}</code>
        </div>
      ) : null}
      <div className="login-field">
        <label htmlFor="mfa-code">Six-digit verification code</label>
        <input
          id="mfa-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={loading}
          required
        />
      </div>
      <button className="primary-button login-submit" type="submit" disabled={loading || !factorId}>
        {loading ? "Preparing verification…" : "Verify and continue"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          The code could not be verified. Check the authenticator and try again.
        </p>
      ) : null}
    </form>
  );
}

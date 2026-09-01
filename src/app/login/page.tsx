import type { Metadata } from "next";

import { LoginForm } from "@/modules/auth/components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Peter Island Resort and Spa IT Service Desk.",
};

export default function LoginPage() {
  return (
    <main id="main-content" className="login-page">
      <section className="login-story" aria-labelledby="login-story-title">
        <div className="login-brand">
          <span className="brand-mark login-brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <small>Peter Island Resort and Spa</small>
            <strong>IT Service Desk</strong>
          </span>
        </div>

        <div className="login-story-copy">
          <p className="overline">Your workday, supported</p>
          <h1 id="login-story-title">A calm place to get technology moving again.</h1>
          <p>
            Report an issue, follow progress, and help the IT team respond to what matters most
            across the resort.
          </p>
        </div>

        <div className="login-trust-note">
          <span className="login-trust-icon" aria-hidden="true">
            ◇
          </span>
          <span>
            <strong>For resort staff and approved partners</strong>
            <small>Use only your assigned work account.</small>
          </span>
        </div>
      </section>

      <section className="login-entry" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-card-heading">
            <p className="overline">Welcome back</p>
            <h2 id="login-title">Sign in to continue</h2>
            <p>Use your Peter Island Resort and Spa work credentials.</p>
          </div>
          <LoginForm />
          <p className="login-support-note">
            Need account help? Contact the IT team through your approved support channel.
          </p>
        </div>

        <footer className="login-footer">
          <span>Peter Island Resort and Spa</span>
          <span aria-hidden="true">·</span>
          <span>IT Service Desk</span>
        </footer>
      </section>
    </main>
  );
}

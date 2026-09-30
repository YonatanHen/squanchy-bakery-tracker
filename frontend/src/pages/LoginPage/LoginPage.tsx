import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/Button/Button";
import { Field } from "../../components/Field/Field";
import { LogoIcon } from "../../components/icons/icons";
import { TextInput } from "../../components/TextInput/TextInput";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import styles from "./LoginPage.module.css";

/** Show the sign-in form and open Readings after a successful login. */
export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /** Send the credentials and show the backend's errors on failure. */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await signIn(username, password);
      navigate("/readings", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setFormError("Wrong username or password.");
      else if (error instanceof ApiError && error.fieldErrors.length > 0)
        setFieldErrors(Object.fromEntries(error.fieldErrors.map((e) => [e.field, e.message])));
      else setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <header className={styles.header}>
          <span className={styles.logo}>
            <LogoIcon />
          </span>
          <h1 className={styles.title}>
            Squanchy <br className={styles.phoneBreak} />
            Fridge Tracker
          </h1>
          <p className={styles.tagline}>Temperature log for every branch.</p>
        </header>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Field label="Username" error={fieldErrors.username}>
            {(control) => (
              <TextInput {...control} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            )}
          </Field>
          <Field label="Password" error={fieldErrors.password}>
            {(control) => (
              <TextInput
                {...control}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          {formError && (
            <p role="alert" className={styles.error}>
              {formError}
            </p>
          )}
          <Button type="submit" size="lg" disabled={busy}>
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}

import { useMutation } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar } from '@/locales/ar';
import { authApi } from '../api/auth-api';
import { AuthLayout } from '../components/AuthLayout';

const t = ar.auth;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const mutation = useMutation({ mutationFn: authApi.forgotPassword });

  const error = mutation.error;
  const emailError =
    isApiError(error) && error.kind === 'validation' ? error.fieldError('email') : undefined;

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ email: email.trim() });
  }

  return (
    <AuthLayout title={t.forgot.title} subtitle={t.forgot.subtitle}>
      {mutation.isSuccess ? (
        // Same message whether or not the email exists (the backend never reveals it).
        <div className="flex flex-col gap-4">
          <Alert tone="success">{t.forgot.sent}</Alert>
          <Link to="/login" className="text-center text-sm text-accent hover:underline">
            {t.forgot.backToLogin}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && !emailError ? <Alert tone="danger">{getErrorMessage(error)}</Alert> : null}
          <TextField
            label={t.email}
            name="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            required
            value={email}
            error={emailError}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={mutation.isPending}
            loadingLabel={t.forgot.submitting}
          >
            {t.forgot.submit}
          </Button>
          <Link to="/login" className="text-center text-sm text-accent hover:underline">
            {t.forgot.backToLogin}
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}

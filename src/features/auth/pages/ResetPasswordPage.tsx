import { useMutation } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar } from '@/locales/ar';
import { authApi } from '../api/auth-api';
import { AuthLayout } from '../components/AuthLayout';

const t = ar.auth;

/** Target of the backend's reset email: /reset-password?token=...&email=... */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const mutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      void navigate('/login', { replace: true, state: { notice: t.reset.done } });
    },
  });

  if (!token || !email) {
    return (
      <AuthLayout title={t.reset.title}>
        <div className="flex flex-col gap-4">
          <Alert tone="danger">{t.reset.invalidLink}</Alert>
          <Link to="/forgot-password" className="text-center text-sm text-accent hover:underline">
            {t.reset.requestNewLink}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const error = mutation.error;
  const validation = isApiError(error) && error.kind === 'validation' ? error : null;
  // An invalid/expired token is reported by the backend on `email`.
  const formError = validation
    ? validation.fieldError('email')
    : error
      ? getErrorMessage(error)
      : null;

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ email, token, password, password_confirmation: confirmation });
  }

  return (
    <AuthLayout title={t.reset.title} subtitle={email}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <TextField
          label={t.password}
          name="password"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          required
          minLength={8}
          hint={t.passwordHint}
          value={password}
          error={validation?.fieldError('password')}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        <TextField
          label={t.passwordConfirmation}
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          required
          value={confirmation}
          error={validation?.fieldError('password_confirmation')}
          onChange={(event) => {
            setConfirmation(event.target.value);
          }}
        />
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={mutation.isPending}
          loadingLabel={t.reset.submitting}
        >
          {t.reset.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}

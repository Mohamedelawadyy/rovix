import { useMutation } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar } from '@/locales/ar';
import { useAuth } from '../auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { safeRedirectPath } from '../redirect';

const t = ar.auth;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      void navigate(safeRedirectPath(params.get('redirect')), { replace: true });
    },
  });

  const error = mutation.error;
  const fieldErrors = isApiError(error) && error.kind === 'validation' ? error : null;
  // Wrong credentials come back as a 422 on `email`; show them as a form-level error.
  const formError =
    error && !fieldErrors ? getErrorMessage(error) : fieldErrors?.fieldError('email');

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ email: email.trim(), password });
  }

  return (
    <AuthLayout title={t.login.title} subtitle={t.login.subtitle}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {notice && !error ? <Alert tone="success">{notice}</Alert> : null}
        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <TextField
          label={t.email}
          name="email"
          type="email"
          autoComplete="username"
          dir="ltr"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <TextField
          label={t.password}
          name="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          value={password}
          error={fieldErrors?.fieldError('password')}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={mutation.isPending}
          loadingLabel={t.login.submitting}
        >
          {t.login.submit}
        </Button>

        <Link to="/forgot-password" className="text-center text-sm text-accent hover:underline">
          {t.login.forgot}
        </Link>
      </form>
    </AuthLayout>
  );
}

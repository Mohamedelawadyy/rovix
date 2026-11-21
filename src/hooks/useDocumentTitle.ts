import { useEffect } from 'react';
import { env } from '@/app/config/env';

/** Sets `document.title` to "<page> | <app name>" (or just the app name). */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} | ${env.appName}` : env.appName;
  }, [title]);
}

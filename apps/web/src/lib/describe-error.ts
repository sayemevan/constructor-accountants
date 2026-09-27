import { ClientErrorCode, isApiError } from './api-error';

export interface ErrorDescription {
  title: string;
  message: string;
  /** Shown so users can quote it to support. */
  reference: string | null;
  /** Whether offering "Try again" makes sense. */
  retryable: boolean;
}

/** Maps any thrown value to user-facing copy for `ErrorState` (ai-context/20-error-handling.md → Frontend). */
export function describeError(error: unknown): ErrorDescription {
  if (!isApiError(error)) {
    const digest = error instanceof Error && 'digest' in error ? String(error.digest) : null;
    return {
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Please try again.',
      reference: digest,
      retryable: true,
    };
  }
  const reference = error.requestId;
  if (error.status === 403) {
    return {
      title: "You don't have access",
      message: 'Ask an administrator if you need access to this page.',
      reference,
      retryable: false,
    };
  }
  if (error.status === 404) {
    return {
      title: 'Not found',
      message: 'It may have been removed, or the link is incorrect.',
      reference,
      retryable: false,
    };
  }
  if (error.code === ClientErrorCode.NETWORK_ERROR) {
    return { title: "You're offline", message: error.message, reference: null, retryable: true };
  }
  return { title: 'Something went wrong', message: error.message, reference, retryable: true };
}

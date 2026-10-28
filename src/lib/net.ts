/** True when an error means "could not reach the server" (as opposed to the server rejecting the request). */
export function isNetworkError(e: unknown): boolean {
  if (!e) return false;
  const obj = e as { message?: unknown; name?: unknown };
  const msg = String(typeof obj.message === 'string' ? obj.message : e).toLowerCase();
  const name = typeof obj.name === 'string' ? obj.name : '';
  return (
    name === 'AuthRetryableFetchError' ||
    /network request failed|failed to fetch|networkerror|network error|load failed|fetch failed|timed? ?out|offline|econnrefused|enotfound|err_internet_disconnected/.test(
      msg,
    )
  );
}

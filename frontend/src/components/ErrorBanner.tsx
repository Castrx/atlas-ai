export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <svg
        className="error-banner__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <span className="error-banner__text">{message}</span>
      {onRetry && (
        <button type="button" className="error-banner__retry" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

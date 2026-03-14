interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="m-3 bg-err/10 border border-err rounded p-3 text-err text-sm leading-relaxed">
      <div className="flex justify-between items-start">
        <div>
          <strong>Error</strong>
          <br />
          {message}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-err/60 hover:text-err cursor-pointer text-lg leading-none ml-2"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

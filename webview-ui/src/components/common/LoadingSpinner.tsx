interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export function LoadingSpinner({ message = "Loading…", className = "" }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center h-48 gap-2.5 text-dim ${className}`}>
      <div className="w-5 h-5 rounded-full border-2 border-border2 border-t-accent animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

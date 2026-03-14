import type { ReactNode } from "react";

interface ActionButtonProps {
  onClick: () => void;
  title: string;
  variant?: "default" | "accent" | "danger";
  children: ReactNode;
  className?: string;
}

const variants = {
  default: "text-dim border-border2 hover:text-accent hover:border-accent/30",
  accent: "text-link border-link/50 hover:bg-link/10",
  danger: "text-err border-err/30 hover:bg-err/10",
};

export function ActionButton({
  onClick,
  title,
  variant = "default",
  children,
  className = "",
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-1.5 py-0.5 rounded text-xs border cursor-pointer transition-colors
        bg-surface ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

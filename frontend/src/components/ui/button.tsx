import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "border border-blue-700/20 bg-blue-600 text-white shadow-sm hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:translate-y-0 active:bg-blue-800 disabled:border-blue-200 disabled:bg-blue-300 disabled:shadow-none disabled:cursor-not-allowed",
  outline:
    "border border-slate-300 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md active:translate-y-0 active:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed",
  ghost:
    "text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed",
};

export const Button = ({
  className,
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
      variantStyles[variant],
      className,
    )}
    {...props}
  />
);

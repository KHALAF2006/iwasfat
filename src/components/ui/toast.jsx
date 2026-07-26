import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toast primitives built on Radix UI (installed: @radix-ui/react-toast).
 *
 * Visibility is controlled by React state (`open`) with conditional render,
 * NOT by CSS animations — this environment can pause CSS animations, which
 * previously left toasts stuck on screen and made the close button useless.
 *
 * Behavior provided by Radix: auto-dismiss timer (duration on Provider),
 * pause-on-hover, swipe-to-dismiss, and a wired Close button.
 */

const ToastProvider = ({ children, ...props }) => (
  <ToastPrimitives.Provider duration={6000} swipeDirection="left" {...props}>
    {children}
  </ToastPrimitives.Provider>
);
ToastProvider.displayName = "ToastProvider";

const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const variantClasses = {
  default: "border-border bg-background text-foreground",
  destructive: "border-destructive bg-destructive text-destructive-foreground",
};

const Toast = React.forwardRef(({ className, variant = "default", open, ...props }, ref) => {
  // Instant, animation-independent hide: a dismissed toast unmounts right away.
  if (open === false) return null;
  return (
    <ToastPrimitives.Root
      ref={ref}
      forceMount
      open={open}
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl border p-4 pe-11 shadow-lg",
        "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
        variantClasses[variant] || variantClasses.default,
        className
      )}
      {...props}
    />
  );
});
Toast.displayName = "Toast";

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    aria-label="Close"
    className={cn(
      "absolute end-2.5 top-2.5 rounded-md p-1.5 text-foreground/60 hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
      className
    )}
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-relaxed", className)}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90 leading-relaxed", className)}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};

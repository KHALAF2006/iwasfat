// Framework-free API error helper.
// Shows a bilingual toast (via the app's shadcn toaster) for any failed
// Base44 SDK write so a failed save can never fail silently.

import { toast } from "@/components/ui/use-toast";

function isArabic() {
  if (typeof document === "undefined") return true;
  const lang = (document.documentElement.lang || "").toLowerCase();
  return lang.startsWith("ar");
}

function getStatus(err) {
  return (
    err?.response?.status ??
    err?.status ??
    err?.statusCode ??
    null
  );
}

function extractReason(err) {
  const data = err?.response?.data;
  const candidates = [
    data?.message,
    data?.error,
    typeof data === "string" ? data : null,
    err?.message,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function isPermissionError(err) {
  const status = getStatus(err);
  if (status === 401 || status === 403) return true;
  const reason = (extractReason(err) || "").toLowerCase();
  return (
    reason.includes("forbidden") ||
    reason.includes("permission") ||
    reason.includes("unauthorized") ||
    reason.includes("not allowed") ||
    reason.includes("access denied")
  );
}

export function getApiErrorMessage(err) {
  const ar = isArabic();
  const reason = extractReason(err);
  let message = ar
    ? `تعذر الحفظ${reason ? `: ${reason}` : ""}`
    : `Could not save${reason ? `: ${reason}` : ""}`;

  if (isPermissionError(err)) {
    message += ar
      ? " — يبدو أن هناك مشكلة في صلاحيات الحساب — تواصل مع الدعم"
      : " — There seems to be a problem with your account permissions — please contact support";
  }
  return message;
}

export function showApiError(err, options = {}) {
  const ar = isArabic();
  toast({
    title: options.title || (ar ? "حدث خطأ" : "Something went wrong"),
    description: options.description || getApiErrorMessage(err),
    variant: "destructive",
  });
}

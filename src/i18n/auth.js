// Auth pages dictionary — nested under one top-level `auth` block.
// The parent agent merges this centrally into ar.js / en.js.
// Components use t('auth.xxx').

export const ar = {
  auth: {
    // existing keys (kept in sync with ar.js)
    login: "تسجيل الدخول",
    logout: "تسجيل الخروج",
    loginRequiredTitle: "سجّل الدخول أولاً 👋",
    loginRequiredBody: "لإكمال تسجيل بياناتك الصحية، نحتاج أولاً أن تسجّل دخولك إلى حسابك.",
    loginRequiredCta: "تسجيل الدخول والمتابعة",

    // shared
    appTagline: "رحلتك الصحية تبدأ من هنا",
    email: "البريد الإلكتروني",
    emailPlaceholder: "name@example.com",
    password: "كلمة المرور",
    passwordPlaceholder: "••••••••",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور",
    fullName: "الاسم الكامل",
    fullNamePlaceholder: "مثال: خلف العتيبي",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    backToLogin: "العودة لتسجيل الدخول",
    fieldRequired: "هذا الحقل مطلوب",
    invalidEmail: "يرجى إدخال بريد إلكتروني صحيح",
    passwordTooShort: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
    errorGeneric: "حدث خطأ غير متوقع. حاول مرة أخرى.",
    errorNetwork: "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.",

    // login
    loginTitle: "مرحباً بعودتك 👋",
    loginSubtitle: "سجّل دخولك للمتابعة إلى خطتك الصحية",
    rememberMe: "تذكرني على هذا الجهاز",
    forgotPassword: "نسيت كلمة المرور؟",
    signingIn: "جارٍ تسجيل الدخول…",
    noAccount: "ليس لديك حساب؟",
    createAccount: "إنشاء حساب",
    loginSuccess: "تم تسجيل الدخول بنجاح",
    errorInvalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    errorUnverified: "حسابك غير مفعّل بعد. أدخل رمز التحقق المرسل إلى بريدك الإلكتروني.",
    resendOtp: "إعادة إرسال رمز التحقق",
    resendOtpSent: "تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني",

    // register
    registerTitle: "أنشئ حسابك",
    registerSubtitle: "خطوة واحدة تفصلك عن بداية رحلتك",
    creatingAccount: "جارٍ إنشاء الحساب…",
    haveAccount: "لديك حساب بالفعل؟",
    strengthWeak: "ضعيفة",
    strengthFair: "متوسطة",
    strengthStrong: "قوية",
    strengthHint: "استخدم 8+ أحرف مع أحرف كبيرة وصغيرة وأرقام ورموز",
    passwordsMatch: "كلمتا المرور متطابقتان",
    passwordsNoMatch: "كلمتا المرور غير متطابقتين",
    errorEmailExists: "هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول.",

    // OTP
    otpTitle: "تحقق من بريدك الإلكتروني",
    otpSubtitle: "أرسلنا رمز تحقق مكوّناً من 6 أرقام إلى {{email}}",
    otpVerify: "تأكيد الرمز",
    otpVerifying: "جارٍ التحقق…",
    otpResendIn: "يمكنك إعادة الإرسال بعد {{seconds}} ثانية",
    otpResend: "إعادة إرسال الرمز",
    otpResending: "جارٍ الإرسال…",
    otpResent: "تم إرسال رمز جديد إلى بريدك الإلكتروني",
    otpErrorInvalid: "رمز التحقق غير صحيح أو منتهي الصلاحية",
    verifySuccess: "تم تفعيل حسابك بنجاح 🎉",

    // pending admin approval
    pendingTitle: "طلبك قيد المراجعة ⏳",
    pendingBody: "تم استلام طلب إنشاء حسابك بنجاح. حسابك بانتظار موافقة الإدارة، وسيصلك بريد إلكتروني فور تفعيله.",
    pendingBackToLogin: "العودة إلى تسجيل الدخول",

    // forgot password
    forgotTitle: "استعادة كلمة المرور",
    forgotSubtitle: "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين",
    sendResetLink: "إرسال رابط الاستعادة",
    sendingResetLink: "جارٍ الإرسال…",
    checkEmailTitle: "تحقق من بريدك الإلكتروني 📬",
    checkEmailBody: "إذا كان البريد {{email}} مسجّلاً لدينا، فقد أرسلنا إليه رابطاً لإعادة تعيين كلمة المرور.",
    resendEmail: "إعادة إرسال البريد",
    resendEmailSent: "تم إعادة إرسال البريد",

    // reset password
    resetTitle: "تعيين كلمة مرور جديدة",
    resetSubtitle: "اختر كلمة مرور قوية لحماية حسابك",
    resetPasswordCta: "حفظ كلمة المرور",
    resettingPassword: "جارٍ الحفظ…",
    resetSuccessTitle: "تم تغيير كلمة المرور ✅",
    resetSuccessBody: "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.",
    resetInvalidTitle: "الرابط غير صالح",
    resetInvalidBody: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً.",
    requestNewLink: "طلب رابط جديد",
    errorResetFailed: "تعذر تغيير كلمة المرور. قد يكون الرابط منتهي الصلاحية.",

    // device binding
    deviceSignedOut: "تم تسجيل دخولك من جهاز آخر",
  },
};

export const en = {
  auth: {
    // existing keys (kept in sync with en.js)
    login: "Sign in",
    logout: "Sign out",
    loginRequiredTitle: "Sign in first 👋",
    loginRequiredBody: "To complete your health profile, you need to sign in to your account first.",
    loginRequiredCta: "Sign in and continue",

    // shared
    appTagline: "Your health journey starts here",
    email: "Email",
    emailPlaceholder: "name@example.com",
    password: "Password",
    passwordPlaceholder: "••••••••",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    fullName: "Full name",
    fullNamePlaceholder: "e.g. Khalaf Alotaibi",
    showPassword: "Show password",
    hidePassword: "Hide password",
    backToLogin: "Back to sign in",
    fieldRequired: "This field is required",
    invalidEmail: "Please enter a valid email address",
    passwordTooShort: "Password must be at least 8 characters",
    errorGeneric: "Something went wrong. Please try again.",
    errorNetwork: "Could not reach the server. Check your internet connection.",

    // login
    loginTitle: "Welcome back 👋",
    loginSubtitle: "Sign in to continue to your health plan",
    rememberMe: "Remember me on this device",
    forgotPassword: "Forgot your password?",
    signingIn: "Signing in…",
    noAccount: "Don't have an account?",
    createAccount: "Create account",
    loginSuccess: "Signed in successfully",
    errorInvalidCredentials: "Incorrect email or password",
    errorUnverified: "Your account is not verified yet. Enter the code sent to your email.",
    resendOtp: "Resend verification code",
    resendOtpSent: "A new verification code was sent to your email",

    // register
    registerTitle: "Create your account",
    registerSubtitle: "One step away from starting your journey",
    creatingAccount: "Creating your account…",
    haveAccount: "Already have an account?",
    strengthWeak: "Weak",
    strengthFair: "Fair",
    strengthStrong: "Strong",
    strengthHint: "Use 8+ characters with upper & lower case, numbers and symbols",
    passwordsMatch: "Passwords match",
    passwordsNoMatch: "Passwords do not match",
    errorEmailExists: "This email is already registered. Try signing in instead.",

    // OTP
    otpTitle: "Check your email",
    otpSubtitle: "We sent a 6-digit verification code to {{email}}",
    otpVerify: "Verify code",
    otpVerifying: "Verifying…",
    otpResendIn: "You can resend in {{seconds}}s",
    otpResend: "Resend code",
    otpResending: "Sending…",
    otpResent: "A new code was sent to your email",
    otpErrorInvalid: "The verification code is incorrect or expired",
    verifySuccess: "Your account is verified 🎉",

    // pending admin approval
    pendingTitle: "Your request is under review ⏳",
    pendingBody: "Your account request was received. It is awaiting admin approval and you will get an email as soon as it is activated.",
    pendingBackToLogin: "Back to sign in",

    // forgot password
    forgotTitle: "Reset your password",
    forgotSubtitle: "Enter your email and we'll send you a reset link",
    sendResetLink: "Send reset link",
    sendingResetLink: "Sending…",
    checkEmailTitle: "Check your email 📬",
    checkEmailBody: "If {{email}} is registered with us, we've sent it a password reset link.",
    resendEmail: "Resend email",
    resendEmailSent: "Email resent",

    // reset password
    resetTitle: "Set a new password",
    resetSubtitle: "Choose a strong password to protect your account",
    resetPasswordCta: "Save password",
    resettingPassword: "Saving…",
    resetSuccessTitle: "Password updated ✅",
    resetSuccessBody: "You can now sign in with your new password.",
    resetInvalidTitle: "Invalid link",
    resetInvalidBody: "This reset link is invalid or has expired. Please request a new one.",
    requestNewLink: "Request a new link",
    errorResetFailed: "Could not update your password. The link may have expired.",

    // device binding
    deviceSignedOut: "You were signed out because your account signed in on another device",
  },
};

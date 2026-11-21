/**
 * Arabic UI strings (default locale). Structured as an i18n resource so it can be handed to
 * i18next unchanged when English support lands.
 */
export const ar = {
  common: {
    loading: 'جاري التحميل…',
    retry: 'إعادة المحاولة',
    reload: 'إعادة تحميل الصفحة',
    backHome: 'الرجوع للرئيسية',
  },
  nav: {
    label: 'القائمة الرئيسية',
    open: 'فتح القائمة',
    close: 'إغلاق القائمة',
    skipToContent: 'تخطي إلى المحتوى',
    dashboard: 'لوحة التحكم',
    vehicles: 'المخزون',
    customers: 'العملاء',
    salesContracts: 'عقود البيع',
    reservations: 'الحجوزات',
  },
  layout: {
    allBranches: 'كل الفروع',
    underConstruction: 'القسم ده قيد التطوير وهيكون متاح قريبًا.',
    welcomeTitle: 'أهلًا، {{name}}',
    noModules: 'مفيش أقسام متاحة لحسابك في النسخة الحالية. تواصل مع مدير النظام لو محتاج صلاحيات.',
  },
  pages: {
    forbiddenTitle: 'غير مسموح',
    forbiddenBody: 'معندكش صلاحية لفتح الصفحة دي.',
    notFoundTitle: 'الصفحة غير موجودة',
    notFoundBody: 'اللينك اللي فتحته مش موجود أو اتنقل.',
    errorTitle: 'حصلت مشكلة',
    errorBody: 'حصل خطأ غير متوقع أثناء عرض الصفحة.',
  },
  errors: {
    generic: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
    network: 'تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى.',
    server: 'حدث خطأ في الخادم. حاول مرة أخرى لاحقًا.',
    rateLimited: 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.',
    sessionUnavailable: 'تعذر التحقق من الجلسة.',
  },
  auth: {
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    passwordConfirmation: 'تأكيد كلمة المرور',
    passwordHint: '٨ أحرف على الأقل، وتحتوي على حروف وأرقام.',
    login: {
      title: 'تسجيل الدخول',
      subtitle: 'ادخل ببيانات حسابك للمتابعة',
      submit: 'دخول',
      submitting: 'جاري الدخول…',
      forgot: 'نسيت كلمة المرور؟',
    },
    forgot: {
      title: 'استعادة كلمة المرور',
      subtitle: 'هنبعت لك لينك لتعيين كلمة مرور جديدة',
      submit: 'إرسال اللينك',
      submitting: 'جاري الإرسال…',
      sent: 'لو البريد مسجل عندنا، هيوصلك لينك إعادة تعيين كلمة المرور خلال دقائق.',
      backToLogin: 'الرجوع لتسجيل الدخول',
    },
    reset: {
      title: 'تعيين كلمة مرور جديدة',
      submit: 'حفظ كلمة المرور',
      submitting: 'جاري الحفظ…',
      invalidLink: 'لينك إعادة التعيين غير صالح أو ناقص. اطلب لينك جديد.',
      requestNewLink: 'طلب لينك جديد',
      done: 'تم تغيير كلمة المرور. سجّل دخولك بكلمة المرور الجديدة.',
    },
    home: {
      welcome: 'أهلًا، {{name}}',
      logout: 'تسجيل الخروج',
      loggingOut: 'جاري الخروج…',
    },
  },
} as const;

/** Replaces `{{key}}` placeholders. */
export function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

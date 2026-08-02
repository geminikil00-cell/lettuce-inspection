import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English translations
const en = {
  translation: {
    "Home": "Home",
    "Charts": "Charts",
    "Parameters": "Parameters",
    "LettuceInspect": "LettuceInspect",
    "Recent Inspections": "Recent Inspections",
    "Manage and review your field data.": "Manage and review your field data.",
    "New Inspection": "New Inspection",
    "No inspections yet": "No inspections yet",
    "Ready to get started? Tap the button above to begin your first lettuce inspection.": "Ready to get started? Tap the button above to begin your first lettuce inspection.",
    "Connection Error": "Connection Error",
    "Heads": "Heads",
    "View full report": "View full report",
    "Settings": "Settings",
    "Language": "Language",
    "Save": "Save",
    "Cancel": "Cancel",
    "Add": "Add",
    "Edit": "Edit",
    "Delete": "Delete",
    "Report": "Report",
    "Inspector": "Inspector",
    "Farm": "Farm",
    "Date": "Date"
  }
};

// Arabic translations
const ar = {
  translation: {
    "Home": "الرئيسية",
    "Charts": "الرسوم البيانية",
    "Parameters": "المعلمات",
    "LettuceInspect": "فحص الخس",
    "Recent Inspections": "عمليات الفحص الأخيرة",
    "Manage and review your field data.": "إدارة ومراجعة بيانات الحقل الخاصة بك.",
    "New Inspection": "فحص جديد",
    "No inspections yet": "لا توجد عمليات فحص بعد",
    "Ready to get started? Tap the button above to begin your first lettuce inspection.": "هل أنت مستعد للبدء؟ اضغط على الزر أعلاه لبدء أول فحص للخس.",
    "Connection Error": "خطأ في الاتصال",
    "Heads": "رؤوس",
    "View full report": "عرض التقرير الكامل",
    "Settings": "الإعدادات",
    "Language": "اللغة",
    "Save": "حفظ",
    "Cancel": "إلغاء",
    "Add": "إضافة",
    "Edit": "تعديل",
    "Delete": "حذف",
    "Report": "تقرير",
    "Inspector": "المفتش",
    "Farm": "المزرعة",
    "Date": "التاريخ"
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en,
      ar
    },
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;

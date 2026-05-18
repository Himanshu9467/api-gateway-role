import { useTranslation } from "react-i18next";

export const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language" className="text-xs text-slate-500">
        {t("language.label")}
      </label>
      <select
        id="language"
        value={i18n.resolvedLanguage || "en"}
        onChange={(event) => {
          void i18n.changeLanguage(event.target.value);
        }}
        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500"
      >
        <option value="en">{t("language.en")}</option>
        <option value="hi">{t("language.hi")}</option>
        <option value="es">{t("language.es")}</option>
      </select>
    </div>
  );
};

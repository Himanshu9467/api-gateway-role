import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Modal } from "../common/Modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  clientTypeOptions,
  createClientSchema,
  type CreateClientFormValues,
  serviceTierOptions,
} from "../../features/dashboard/createClient.schema";

interface NewClientModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateClientFormValues) => Promise<void>;
  isSubmitting: boolean;
  errorMessage?: string;
}

const selectClassName =
  "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100";

export const NewClientModal = ({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: NewClientModalProps) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateClientFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      companyName: "",
      contactPerson: "",
      email: "",
      jurisdiction: "",
      serviceTier: "Starter",
      clientType: "Corporate",
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (isSubmitting) return;
        onClose();
      }}
      title={t("dashboard.newClientTitle")}
      description={t("dashboard.newClientDescription")}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMessage ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="companyName">{t("dashboard.form.companyName")}</Label>
            <Input id="companyName" {...register("companyName")} />
            {errors.companyName ? (
              <p className="text-sm text-red-600">{t(errors.companyName.message || "")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPerson">{t("dashboard.form.contactPerson")}</Label>
            <Input id="contactPerson" {...register("contactPerson")} />
            {errors.contactPerson ? (
              <p className="text-sm text-red-600">{t(errors.contactPerson.message || "")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("dashboard.form.email")}</Label>
            <Input id="email" type="email" placeholder="ops@company.com" {...register("email")} />
            {errors.email ? (
              <p className="text-sm text-red-600">{t(errors.email.message || "")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="jurisdiction">{t("dashboard.form.jurisdiction")}</Label>
            <Input id="jurisdiction" {...register("jurisdiction")} />
            {errors.jurisdiction ? (
              <p className="text-sm text-red-600">{t(errors.jurisdiction.message || "")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceTier">{t("dashboard.form.serviceTier")}</Label>
            <select id="serviceTier" className={selectClassName} {...register("serviceTier")}>
              {serviceTierOptions.map((option) => (
                <option key={option} value={option}>
                  {t(`dashboard.form.serviceTierOptions.${option}`)}
                </option>
              ))}
            </select>
            {errors.serviceTier ? (
              <p className="text-sm text-red-600">{t(errors.serviceTier.message || "")}</p>
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="clientType">{t("dashboard.form.clientType")}</Label>
            <select id="clientType" className={selectClassName} {...register("clientType")}>
              {clientTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {t(`dashboard.form.clientTypeOptions.${option}`)}
                </option>
              ))}
            </select>
            {errors.clientType ? (
              <p className="text-sm text-red-600">{t(errors.clientType.message || "")}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("dashboard.form.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("dashboard.form.creating") : t("dashboard.form.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

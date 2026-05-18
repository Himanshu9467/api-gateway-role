import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRegisterMutation } from "../hooks/useAuthMutations";
import { registerSchema, type RegisterFormValues } from "../../../services/auth/auth.schemas";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mutateAsync, isPending, error } = useRegisterMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    await mutateAsync({
      name: values.name,
      email: values.email,
      password: values.password,
    });
    navigate("/login", { replace: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.registerTitle")}</CardTitle>
        <CardDescription>{t("auth.registerDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">{t(errors.name.message || "")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" placeholder="user@example.com" {...register("email")} />
            {errors.email && <p className="text-sm text-red-600">{t(errors.email.message || "")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" type="password" {...register("password")} />
            {errors.password && (
              <p className="text-sm text-red-600">{t(errors.password.message || "")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
            <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">{t(errors.confirmPassword.message || "")}</p>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600">
              {(error as Error).message || t("auth.registerFailed")}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? t("common.loading") : t("auth.registerButton")}
          </Button>
          <p className="text-center text-sm text-slate-600">
            {t("auth.hasAccount")}{" "}
            <Link to="/login" className="font-medium text-blue-600 hover:underline">
              {t("auth.loginLink")}
            </Link>
          </p>
        </motion.form>
      </CardContent>
    </Card>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLoginMutation } from "../hooks/useAuthMutations";
import { loginSchema, type LoginFormValues } from "../../../services/auth/auth.schemas";
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

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { mutateAsync, isPending, error } = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    await mutateAsync(values);
    const state = location.state as LocationState | null;
    navigate(state?.from || "/dashboard", { replace: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.loginTitle")}</CardTitle>
        <CardDescription>{t("auth.loginDescription")}</CardDescription>
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
          {error && (
            <p className="text-sm text-red-600">{(error as Error).message || t("auth.loginFailed")}</p>
          )}
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? t("common.loading") : t("auth.loginButton")}
          </Button>
          <p className="text-center text-sm text-slate-600">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="font-medium text-blue-600 hover:underline">
              {t("auth.registerLink")}
            </Link>
          </p>
        </motion.form>
      </CardContent>
    </Card>
  );
}

import { motion } from "framer-motion";
import { Outlet } from "react-router-dom";
import { LanguageSwitcher } from "../components/common/LanguageSwitcher";

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Outlet />
      </motion.div>
    </div>
  );
}

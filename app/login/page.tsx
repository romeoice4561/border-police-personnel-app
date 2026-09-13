/**
 * Login route (Phase 46). Renders the full-screen LoginScreen. The AppShell
 * (nav sidebar/header) is bypassed for this route so login has no app chrome —
 * see components/layout/app_shell.tsx's LOGIN_ROUTE guard clause.
 */
import { LoginScreen } from "@/components/auth/login_screen";

export const metadata = {
  title: "C-INTEL | เข้าสู่ระบบ",
};

export default function LoginPage() {
  return <LoginScreen />;
}

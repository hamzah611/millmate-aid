import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Wheat } from "lucide-react";

const Auth = () => {
  const { t, toggleLanguage, language } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("auth.checkEmail"));
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_50%)]" />
      <Card className="w-full max-w-md relative shadow-lg border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
            <Wheat className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">{t("app.title")}</CardTitle>
          <CardDescription className="mt-1">
            {isLogin ? t("auth.login") : t("auth.signup")}
          </CardDescription>
          <Button variant="ghost" size="sm" onClick={toggleLanguage} className="mx-auto mt-1 text-muted-foreground">
            {language === "en" ? "اردو" : "English"}
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input
                placeholder={t("auth.fullName")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11"
              />
            )}
            <Input
              type="email"
              placeholder={t("auth.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
            <Input
              type="password"
              placeholder={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11"
            />
            <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
              {loading
                ? isLogin ? t("auth.loggingIn") : t("auth.signingUp")
                : isLogin ? t("auth.login") : t("auth.signup")}
            </Button>
          </form>
          <div className="mt-5 text-center text-sm">
            <span className="text-muted-foreground">
              {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
            </span>
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              {isLogin ? t("auth.signup") : t("auth.login")}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;

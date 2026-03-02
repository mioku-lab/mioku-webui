import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveAuth } from "@/lib/api";
import { useAppDispatch } from "@/app/hooks";
import { setToken } from "./authSlice";

export function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [token, setTokenInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        throw new Error("密钥错误或已过期");
      }

      const data = await res.json();
      saveAuth(token, data.expiresAt);
      dispatch(setToken(token));
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md animate-soft-pop">
        <CardHeader>
          <CardTitle>Mioku WebUI 登录</CardTitle>
          <CardDescription>请输入 config/webui/auth.json 中的 token</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input value={token} onChange={(e) => setTokenInput(e.target.value)} placeholder="输入密钥" />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <Button className="w-full" disabled={loading}>{loading ? "登录中..." : "登录"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

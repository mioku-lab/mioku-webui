import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { clearAuth } from "@/lib/api";
import { useAppDispatch } from "@/app/hooks";
import { setToken } from "@/features/auth/authSlice";

export function WebUIManagePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  return (
    <div className="animate-soft-pop space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>WebUI 管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">这里用于放置 WebUI 自身相关操作。</p>
          <Button
            variant="outline"
            onClick={() => {
              clearAuth();
              dispatch(setToken(null));
              navigate("/login");
            }}
          >
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

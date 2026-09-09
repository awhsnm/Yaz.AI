import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const BetaLocked = () => {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold font-display text-foreground">Private beta</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This platform is currently in a private beta. Please contact the administrator if you
          believe you should have access.
        </p>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </div>
    </div>
  );
};

export default BetaLocked;

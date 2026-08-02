import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SchoolAccessModal = ({ open, onOpenChange }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("teacher");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!school.trim() || !email.trim()) {
      toast({ title: t("school.required"), variant: "destructive" });
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      onOpenChange(false);
      setSchool(""); setEmail(""); setMessage("");
      toast({ title: t("school.sent"), description: t("school.sentDesc") });
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            {t("school.title")}
          </DialogTitle>
          <DialogDescription className="font-display">{t("school.desc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sa-school">{t("school.name")}</Label>
            <Input id="sa-school" value={school} onChange={(e) => setSchool(e.target.value)} placeholder={t("school.namePh")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-email">{t("school.email")}</Label>
            <Input id="sa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.kz" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("school.role")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">{t("school.roleTeacher")}</SelectItem>
                <SelectItem value="admin">{t("school.roleAdmin")}</SelectItem>
                <SelectItem value="other">{t("school.roleOther")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sa-msg">{t("school.message")}</Label>
            <Textarea id="sa-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("school.messagePh")} />
          </div>
          <Button type="submit" className="w-full font-display" disabled={busy}>
            <Send className="w-4 h-4 mr-2" />
            {busy ? t("school.sending") : t("school.send")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SchoolAccessModal;

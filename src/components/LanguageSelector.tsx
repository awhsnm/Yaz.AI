import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useSettings, type Lang } from "@/contexts/SettingsContext";

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "kk", flag: "🇰🇿", label: "Қазақша" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
];

const LanguageSelector = ({ className }: { className?: string }) => {
  const { lang, setLang } = useSettings();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Change language"
          className={`font-display gap-1.5 px-2 ${className ?? ""}`}
        >
          <Globe className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase">{lang}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px] bg-popover z-50">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => setLang(l.code)}
            className={`font-display gap-2 cursor-pointer ${lang === l.code ? "text-primary font-semibold" : ""}`}
          >
            <span>{l.flag}</span>
            <span>{l.label}</span>
            <span className="ml-auto text-xs uppercase text-muted-foreground">{l.code}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ContactForm from "@/components/ContactForm";

const ContactNew = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate("/contacts")} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> {t("contacts.title")}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{t("contacts.add")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm onSuccess={() => navigate("/contacts")} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactNew;

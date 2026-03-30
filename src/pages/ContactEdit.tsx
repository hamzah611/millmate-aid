import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import ContactForm from "@/components/ContactForm";

const ContactEdit = () => {
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("id", id!).single();
      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        phone: data.phone || "",
        city: data.city || "",
        address: data.address || "",
        contact_type: data.contact_type as "customer" | "supplier" | "both" | "broker",
        credit_limit: data.credit_limit || 0,
        payment_terms: data.payment_terms as "7" | "15" | "30" | null,
        account_category: data.account_category || null,
      };
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate("/contacts")} className="gap-2">
        <BackArrow className="h-4 w-4" /> {t("contacts.title")}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{t("common.edit")} — {contact?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {contact && <ContactForm initial={contact} onSuccess={() => navigate("/contacts")} />}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactEdit;

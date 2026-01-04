import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { PageCardHeader } from "@/components/page-header";

interface FormPageProps {
  template?: string;
  data: any;
  title: string;
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'textarea' | 'select' | 'number';
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

const DefaultFormTemplate = ({ formConfig, title }: { formConfig: any; title: string }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const { t } = useI18n();

  const fields: FormField[] = formConfig?.fields || [
    { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter your name' },
    { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Enter your email' },
    { id: 'message', label: 'Message', type: 'textarea', placeholder: 'Enter your message' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const requiredFields = fields.filter(field => field.required);
    const missingFields = requiredFields.filter(field => !formData[field.id]);
    
    if (missingFields.length > 0) {
      toast({
        title: t("validation_error"),
        description: `${t("fill_required_fields")}: ${missingFields.map(f => f.label).join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    toast({
      title: t("success"),
      description: t("form_submitted"),
    });
    
    // Reset form
    setFormData({});
  };

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id] || '';

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={field.id}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            required={field.required}
          />
        );
      
      case 'select':
        return (
          <Select value={value} onValueChange={(value) => handleInputChange(field.id, value)}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      default:
        return (
          <Input
            id={field.id}
            type={field.type}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            required={field.required}
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {renderField(field)}
        </div>
      ))}
      <Button type="submit" className="w-full">
        {formConfig?.submitText || 'Submit'}
      </Button>
    </form>
  );
};

export const FormPage = ({ template, data, title }: FormPageProps) => {
  const formConfig = data?.form_config || {};

  return (
    <Card>
      <PageCardHeader 
        title={data?.title || title}
        actions={data?.description ? <p className="text-muted-foreground">{data.description}</p> : undefined}
      />
      <CardContent>
        {template === 'custom' ? (
          <div className="text-muted-foreground">
            Custom form template "{template}" not implemented yet.
          </div>
        ) : (
          <DefaultFormTemplate formConfig={formConfig} title={title} />
        )}
      </CardContent>
    </Card>
  );
};

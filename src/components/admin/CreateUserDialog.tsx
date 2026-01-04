import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useI18n } from "@/i18n";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useCreateUser } from "@/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";

// Create schema outside component to avoid re-creation
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  phone: z.string().optional(),
  notify_by_email: z.boolean().default(true),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateUserDialogProps) {
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const createUserMutation = useCreateUser();
  const { toast } = useToast();

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      phone: "",
      notify_by_email: true,
    },
  });

  const onSubmit = async (data: CreateUserFormData) => {
    try {
      // Ensure required fields are provided (schema should handle this, but double-check)
      if (!data.email || !data.password || !data.name) {
        toast({
          title: "Error",
          description: "Email, password, and name are required",
          variant: "destructive",
        });
        return;
      }
      
      await createUserMutation.mutateAsync({
        email: data.email,
        password: data.password,
        name: data.name,
        phone: data.phone || "",
        notify_by_email: data.notify_by_email ?? true,
        role: "user" as const,
      });
      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Failed to create user:", error);
      // Error is handled by the mutation's onError callback
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" noOverlay>
        <DialogHeader>
          <DialogTitle>{t("create_user_title")}</DialogTitle>
          <DialogDescription>
            {t("create_user_desc")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name Field */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form_full_name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("placeholder_full_name")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form_email_address")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t("placeholder_email")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password Field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form_password")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={t("placeholder_password")}
                        {...field}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t("desc_password")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone Field */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form_phone_number")}</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder={t("placeholder_phone")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email Notification Checkbox */}
            <FormField
              control={form.control}
              name="notify_by_email"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t("form_notify_email")}</FormLabel>
                    <FormDescription>
                      {t("desc_email_notify")}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createUserMutation.isPending}
              >
                {t("btn_cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
                className="min-w-[100px]"
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("loading_creating")}
                  </>
                ) : (
                  t("btn_create")
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

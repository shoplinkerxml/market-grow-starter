import React from "react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useI18n } from "@/i18n";
import { Loader2 } from "lucide-react";
import { useUpdateUser } from "@/hooks/useUsers";

// Schema outside component to avoid re-creation
const editUserSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email(), // readonly
});

type EditUserFormData = z.infer<typeof editUserSchema>;

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: "user" | "admin" | "manager";
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  avatar_url?: string;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile;
  onSuccess: () => void;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditUserDialogProps) {
  const { t } = useI18n();
  const updateUserMutation = useUpdateUser();

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name,
      phone: user.phone || "",
      email: user.email,
    },
  });

  // Reset form when user changes
  React.useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        phone: user.phone || "",
        email: user.email,
      });
    }
  }, [user, form]);

  const onSubmit = async (data: EditUserFormData) => {
    try {
      await updateUserMutation.mutateAsync({
        id: user.id,
        data: {
          name: data.name,
          phone: data.phone || undefined,
        },
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to update user:", error);
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
          <DialogTitle>{t("edit_user_title")}</DialogTitle>
          <DialogDescription>
            {t("edit_user_desc")}
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

            {/* Email Field (readonly) */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form_email_address")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      {...field}
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                  </FormControl>
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

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={updateUserMutation.isPending}
              >
                {t("btn_cancel")}
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
                className="min-w-[100px]"
              >
                {updateUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("loading_updating")}
                  </>
                ) : (
                  t("btn_update")
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

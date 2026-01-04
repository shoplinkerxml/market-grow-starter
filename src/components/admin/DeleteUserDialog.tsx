import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useI18n } from "@/i18n";
import { Loader2, AlertTriangle } from "lucide-react";
import { useDeleteUser } from "@/hooks/useUsers";

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

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile;
  onSuccess: () => void;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: DeleteUserDialogProps) {
  const { t } = useI18n();
  const deleteUserMutation = useDeleteUser();

  const handleDelete = async () => {
    try {
      await deleteUserMutation.mutateAsync(user.id);
      onSuccess();
    } catch (error) {
      console.error("Failed to delete user:", error);
      // Error is handled by the mutation's onError callback
    }
  };

  const userInitials = user.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg" noOverlay>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle className="text-left">
                {t("delete_user_title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left">
                {t("delete_user_desc")}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="my-4">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.avatar_url} alt={user.name} />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              {user.phone && (
                <div className="text-sm text-muted-foreground">{user.phone}</div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <h4 className="font-medium text-sm">{t("delete_consequences_title")}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>{t("delete_consequence_1")}</li>
              <li>{t("delete_consequence_2")}</li>
              <li>{t("delete_consequence_3")}</li>
              <li>{t("delete_consequence_4")}</li>
            </ul>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteUserMutation.isPending}>
            {t("btn_cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteUserMutation.isPending}
            className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
          >
            {deleteUserMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("loading_deleting")}
              </>
            ) : (
              t("btn_delete")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

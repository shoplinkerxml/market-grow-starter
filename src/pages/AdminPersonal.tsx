import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProfileService } from "@/lib/profile-service";
import { 
  withProfileErrorHandling, 
  SUCCESS_MESSAGES, 
  ProfileOperationError, 
  ProfileErrorCode 
} from "@/lib/error-handler";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbs, usePageInfo } from "@/hooks/useBreadcrumbs";
import { useI18n } from "@/i18n";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const AdminPersonal = () => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const pageInfo = usePageInfo();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { error, success } = await withProfileErrorHandling(async () => {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        setEmail(user?.email ?? "");
        
        if (user?.id) {
          const profile = await ProfileService.ensureProfile(user.id, {
            email: user.email || '',
            name: user.user_metadata?.name || ''
          });
          
          if (profile) {
            setName(profile.name || "");
            setAvatarUrl(profile.avatar_url || "");
            return profile;
          } else {
            throw new ProfileOperationError(ProfileErrorCode.PROFILE_NOT_FOUND);
          }
        }
        return null;
      }, 'profile loading', SUCCESS_MESSAGES.PROFILE_LOADED);
      if (error) toast.error(error.message);
      else if (success) toast.success(success.message);
    };
    load();
  }, []);

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const { error, success } = await withProfileErrorHandling(async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new ProfileOperationError(ProfileErrorCode.PERMISSION_DENIED);
      
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      
      if (uploadError) {
        throw new ProfileOperationError(ProfileErrorCode.AVATAR_UPLOAD_FAILED, uploadError);
      }
      
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = pub.publicUrl;
      
      const updatedProfile = await ProfileService.updateProfile(user.id, { avatar_url: url });
      
      if (updatedProfile) {
        setAvatarUrl(url);
        return updatedProfile;
      } else {
        throw new ProfileOperationError(ProfileErrorCode.PROFILE_UPDATE_FAILED);
      }
    }, 'avatar upload', SUCCESS_MESSAGES.AVATAR_UPDATED);
    if (error) toast.error(error.message);
    else if (success) toast.success(success.message);
    
    e.target.value = '';
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error, success } = await withProfileErrorHandling(async () => {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        
        if (user?.id) {
          const updatedProfile = await ProfileService.updateProfile(user.id, { name });
          
          if (updatedProfile) {
            return updatedProfile;
          } else {
            throw new ProfileOperationError(ProfileErrorCode.PROFILE_UPDATE_FAILED);
          }
        } else {
          throw new ProfileOperationError(ProfileErrorCode.PERMISSION_DENIED);
        }
      }, 'profile save', SUCCESS_MESSAGES.PROFILE_UPDATED);
      if (error) toast.error(error.message);
      else if (success) toast.success(success.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={pageInfo.title}
        description={pageInfo.description}
        breadcrumbItems={breadcrumbs}
      />
      
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle>{t("user_profile_title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <div 
                className="relative group cursor-pointer" 
                onClick={handleAvatarClick}
              >
                <Avatar className="h-28 w-28 transition-all duration-200 group-hover:brightness-75">
                  <AvatarImage src={avatarUrl || "/placeholder.svg"} />
                  <AvatarFallback>AD</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-full">
                  <Plus className="h-6 w-6 text-white mb-1" />
                  <span className="text-xs text-white font-medium">{t("menu_profile")}</span>
                </div>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                onChange={onAvatarChange} 
                className="hidden"
              />
            </div>
          </div>
          <div className="md:col-span-2 space-y-4">
            <div>
              <label className="text-sm font-medium">{t("form_full_name")}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">{t("form_email_address")}</label>
              <Input value={email} disabled />
            </div>
            <Button onClick={save} disabled={saving} variant="secondary">{t("btn_update")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPersonal;

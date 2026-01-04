import type { Dictionary } from "../types";

export const usersDictionary: Dictionary = {
  users_title: { uk: "Користувачі", en: "Users" },
  users_subtitle: {
    uk: "Управління системними користувачами та їх дозволами",
    en: "Manage system users and their permissions",
  },
  add_user: { uk: "Додати користувача", en: "Add User" },
  available_tariffs: { uk: "Доступні тарифи", en: "Available Tariffs" },
  manage_user_subscriptions: {
    uk: "Керування підписками користувача",
    en: "Manage User Subscriptions",
  },
  view_details: { uk: "Переглянути деталі", en: "View Details" },
  active_tariff: { uk: "Активний тариф", en: "Active Tariff" },
  no_tariff: { uk: "Немає тарифу", en: "No Tariff" },
  subscription_history: {
    uk: "Історія підписок",
    en: "Subscription History",
  },
  subscription_history_desc: {
    uk: "Всі підписки користувача",
    en: "All user subscriptions",
  },
  something_went_wrong: {
    uk: "Щось пішло не так",
    en: "Something went wrong",
  },
  price: { uk: "Ціна", en: "Price" },
  start_date: { uk: "Дата початку", en: "Start Date" },
  end_date: { uk: "Дата закінчення", en: "End Date" },
  status: { uk: "Статус", en: "Status" },
  no_subscriptions: { uk: "Немає підписок", en: "No Subscriptions" },
  free: { uk: "Безкоштовно", en: "Free" },
  lifetime: { uk: "Безстроково", en: "Lifetime" },
  days: { uk: "днів", en: "days" },
  tariff_name: { uk: "Назва тарифу", en: "Tariff Name" },
  active_tariff_title: {
    uk: "Активний тарифний план",
    en: "Active Tariff Plan",
  },
  edit_user: { uk: "Редагувати користувача", en: "Edit User" },
  delete_user: { uk: "Видалити користувача", en: "Delete User" },
  export_users: { uk: "Експорт", en: "Export" },
  table_customer: { uk: "Клієнт", en: "Customer" },
  table_status: { uk: "Статус", en: "Status" },
  table_email: { uk: "Електронна пошта", en: "Email Address" },
  table_phone: { uk: "Телефон", en: "Phone" },
  table_created: { uk: "Створено", en: "Created" },
  table_actions: { uk: "Дії", en: "Actions" },
  status_active: { uk: "Активний", en: "Active" },
  status_inactive: { uk: "Неактивний", en: "Inactive" },
  activate_user: {
    uk: "Активувати користувача",
    en: "Activate User",
  },
  deactivate_user: {
    uk: "Деактивувати користувача",
    en: "Deactivate User",
  },
  edit_action: { uk: "Редагувати", en: "Edit User" },
  delete_action: { uk: "Видалити", en: "Delete User" },
  send_email: { uk: "Надіслати email", en: "Send Email" },
  call_user: { uk: "Зателефонувати", en: "Call User" },
  form_full_name: { uk: "Повне ім'я", en: "Full Name" },
  form_email_address: {
    uk: "Електронна пошта",
    en: "Email Address",
  },
  form_password: { uk: "Пароль", en: "Password" },
  form_phone_number: {
    uk: "Номер телефону (необов'язково)",
    en: "Phone Number (Optional)",
  },
  form_notify_email: {
    uk: "Надіслати облікові дані на пошту",
    en: "Send credentials by email",
  },
  placeholder_full_name: {
    uk: "Введіть повне ім'я користувача",
    en: "Enter user's full name",
  },
  placeholder_email: {
    uk: "user@example.com",
    en: "user@example.com",
  },
  placeholder_password: {
    uk: "Мінімум 8 символів",
    en: "Minimum 8 characters",
  },
  placeholder_phone: {
    uk: "+38 (050) 123-45-67",
    en: "+1 (555) 123-4567",
  },
  desc_password: {
    uk: "Пароль має бути не менше 8 символів",
    en: "Password must be at least 8 characters long",
  },
  desc_email_notify: {
    uk: "Користувач отримає облікові дані на електронну пошту",
    en: "User will receive login credentials via email",
  },
  desc_email_readonly: {
    uk: "Електронну пошту неможливо змінити",
    en: "Email address cannot be changed",
  },
  create_user_title: {
    uk: "Додати нового користувача",
    en: "Add New User",
  },
  create_user_desc: {
    uk: "Створити новий обліковий запис користувача. Користувач отримає облікові дані на електронну пошту.",
    en: "Create a new user account. The user will receive login credentials via email.",
  },
  edit_user_title: {
    uk: "Редагувати користувача",
    en: "Edit User",
  },
  edit_user_desc: {
    uk: "Оновити інформацію користувача. Електронну пошту неможливо змінити.",
    en: "Update user information. Email address cannot be changed.",
  },
  delete_user_title: {
    uk: "Видалити обліковий запис користувача",
    en: "Delete User Account",
  },
  delete_user_desc: {
    uk: "Цю дію неможливо скасувати.",
    en: "This action cannot be undone.",
  },
  confirm_activate: {
    uk: "Ви впевнені, що хочете активувати цього користувача? Він отримає доступ до системи.",
    en: "Are you sure you want to activate this user? They will regain access to the system.",
  },
  confirm_deactivate: {
    uk: "Ви впевнені, що хочете деактивувати цього користувача? Він втратить доступ до системи.",
    en: "Are you sure you want to deactivate this user? They will lose access to the system.",
  },
  delete_consequences_title: {
    uk: "Що станеться при видаленні користувача:",
    en: "What happens when you delete this user:",
  },
  delete_consequence_1: {
    uk: "• Обліковий запис користувача буде назавжди деактивований",
    en: "• User account will be permanently deactivated",
  },
  delete_consequence_2: {
    uk: "• Користувач негайно втратить доступ до системи",
    en: "• User will lose access to the system immediately",
  },
  delete_consequence_3: {
    uk: "• Дані користувача будуть позначені як видалені, але збережені для аудиту",
    en: "• User data will be marked as deleted but retained for audit purposes",
  },
  delete_consequence_4: {
    uk: "• Цю дію неможливо скасувати",
    en: "• This action cannot be undone",
  },
  filters_title: { uk: "Фільтри", en: "Filters" },
  search_placeholder: {
    uk: "Пошук користувачів за ім'ям або email...",
    en: "Search users by name or email...",
  },
  filter_all_status: { uk: "Всі статуси", en: "All Status" },
  filter_all_roles: { uk: "Всі ролі", en: "All Roles" },
  role_user: { uk: "Користувач", en: "User" },
  role_admin: { uk: "Адміністратор", en: "Admin" },
  role_manager: { uk: "Менеджер", en: "Manager" },
  sort_newest_first: {
    uk: "Спочатку нові",
    en: "Newest First",
  },
  sort_oldest_first: {
    uk: "Спочатку старі",
    en: "Oldest First",
  },
  sort_name_az: { uk: "Ім'я А-Я", en: "Name A-Z" },
  sort_name_za: { uk: "Ім'я Я-А", en: "Name Z-A" },
  sort_email_az: { uk: "Email А-Я", en: "Email A-Z" },
  sort_email_za: { uk: "Email Я-А", en: "Email Z-A" },
  refresh: { uk: "Оновити", en: "Refresh" },
  showing_users: { uk: "Показано з", en: "Showing" },
  to: { uk: "до", en: "to" },
  of: { uk: "з", en: "of" },
  users_total: { uk: "користувачів", en: "users" },
  previous: { uk: "Попередня", en: "Previous" },
  prev: { uk: "Попередня", en: "Previous" },
  next: { uk: "Наступна", en: "Next" },
  no_users_found: {
    uk: "Користувачів не знайдено",
    en: "No users found",
  },
  btn_cancel: { uk: "Скасувати", en: "Cancel" },
  btn_create: {
    uk: "Створити користувача",
    en: "Create User",
  },
  btn_update: {
    uk: "Оновити користувача",
    en: "Update User",
  },
  btn_delete: {
    uk: "Видалити користувача",
    en: "Delete User",
  },
  btn_activate: { uk: "Активувати", en: "Activate" },
  btn_deactivate: { uk: "Деактивувати", en: "Deactivate" },
  loading_creating: { uk: "Створення...", en: "Creating..." },
  loading_updating: { uk: "Оновлення...", en: "Updating..." },
  loading_deleting: { uk: "Видалення...", en: "Deleting..." },
  success_user_created: {
    uk: "Користувача успішно створено",
    en: "User created successfully",
  },
  success_user_updated: {
    uk: "Користувача успішно оновлено",
    en: "User updated successfully",
  },
  success_user_deleted: {
    uk: "Користувача успішно видалено",
    en: "User deleted successfully",
  },
  success_user_activated: {
    uk: "Користувача успішно активовано",
    en: "User activated successfully",
  },
  success_user_deactivated: {
    uk: "Користувача успішно деактивовано",
    en: "User deactivated successfully",
  },
  error_create_user: {
    uk: "Не вдалося створити користувача",
    en: "Failed to create user",
  },
  error_update_user: {
    uk: "Не вдалося оновити користувача",
    en: "Failed to update user",
  },
  error_delete_user: {
    uk: "Не вдалося видалити користувача",
    en: "Failed to delete user",
  },
  error_fetch_users: {
    uk: "Не вдалося завантажити користувачів",
    en: "Failed to fetch users",
  },
  error_update_status: {
    uk: "Не вдалося оновити статус користувача",
    en: "Failed to update user status",
  },
  error_try_again: {
    uk: "Будь ласка, спробуйте ще раз",
    en: "Please try again later",
  },
  total_users: {
    uk: "Всього користувачів",
    en: "Total Users",
  },
  active_users: {
    uk: "Активні користувачі",
    en: "Active Users",
  },
  registered_users: {
    uk: "Зареєстровані користувачі",
    en: "Registered Users",
  },
  user_statistics: {
    uk: "Статистика користувачів",
    en: "User Statistics",
  },
  user_created_success: {
    uk: "Користувача успішно створено",
    en: "User created successfully",
  },
  user_updated_success: {
    uk: "Користувача успішно оновлено",
    en: "User updated successfully",
  },
  user_deleted_success: {
    uk: "Користувача успішно видалено",
    en: "User deleted successfully",
  },
  user_fully_deleted: {
    uk: "Користувача повністю видалено з системи",
    en: "User completely removed from system",
  },
  user_profile_deleted: {
    uk: "Профіль користувача видалено",
    en: "User profile deleted",
  },
  user_auth_deleted: {
    uk: "Авторизацію користувача видалено",
    en: "User authentication deleted",
  },
  failed_create_user: {
    uk: "Не вдалося створити користувача",
    en: "Failed to create user",
  },
  failed_update_user: {
    uk: "Не вдалося оновити користувача",
    en: "Failed to update user",
  },
  failed_delete_user: {
    uk: "Не вдалося видалити користувача",
    en: "Failed to delete user",
  },
  user_created_desc: {
    uk: "було створено",
    en: "has been created",
  },
  user_updated_desc: {
    uk: "було оновлено",
    en: "has been updated",
  },
  user_deleted_desc: {
    uk: "було видалено",
    en: "has been deleted",
  },
  user_activated_success: {
    uk: "Користувача успішно активовано",
    en: "User activated successfully",
  },
  user_deactivated_success: {
    uk: "Користувача успішно деактивовано",
    en: "User deactivated successfully",
  },
  user_activated_desc: {
    uk: "було активовано",
    en: "has been activated",
  },
  user_deactivated_desc: {
    uk: "було деактивовано",
    en: "has been deactivated",
  },
  profile_email: { uk: "Електронна пошта", en: "Email" },
  profile_phone: { uk: "Телефон", en: "Phone" },
  profile_member_since: {
    uk: "Учасник з",
    en: "Member Since",
  },
  profile_email_cannot_be_changed: {
    uk: "Електронну пошту не можна змінити",
    en: "Email cannot be changed",
  },
  profile_change_avatar: {
    uk: "Змінити аватар",
    en: "Change Avatar",
  },
  profile_loading: {
    uk: "Завантаження профілю...",
    en: "Loading profile...",
  },
  profile_back_to_dashboard: {
    uk: "Назад до панелі",
    en: "Back to Dashboard",
  },
  profile_personal_information: {
    uk: "Особиста інформація",
    en: "Personal Information",
  },
  profile_update_info: {
    uk: "Оновіть інформацію профілю та аватар",
    en: "Update your profile information and avatar",
  },
  profile_uploading: {
    uk: "Завантаження...",
    en: "Uploading...",
  },
  profile_save_changes: {
    uk: "Зберегти зміни",
    en: "Save Changes",
  },
  profile_updated_success: {
    uk: "Профіль успішно оновлено",
    en: "Profile updated successfully",
  },
  failed_update_profile: {
    uk: "Не вдалося оновити профіль",
    en: "Failed to update profile",
  },
  avatar_updated_success: {
    uk: "Аватар успішно оновлено",
    en: "Avatar updated successfully",
  },
  failed_upload_avatar: {
    uk: "Не вдалося завантажити аватар",
    en: "Failed to upload avatar",
  },
};

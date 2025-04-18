export interface UserSession {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  last_active: string;
}

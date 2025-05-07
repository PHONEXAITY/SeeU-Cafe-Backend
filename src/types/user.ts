// src/types/user.ts
export interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  profile_photo: string | null;
  User_id: bigint;
  email_verified: boolean;
  social_provider: string | null;
  role: {
    name: string;
  } | null;
}

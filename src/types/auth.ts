export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
  phone: string | null;
}

export interface AuthenticatedSession {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface GetSessionDetailInput {
  userId: string;
  session: AuthenticatedSession;
}

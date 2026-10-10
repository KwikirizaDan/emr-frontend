/**
 * Users service (admin).
 */

import { getList, getOne } from "@/services/http/list-helpers";
import { bffRequest } from "@/services/http/bff-client";
import type { Paginated, User } from "@/services/http/api-types";

export type UserFilters = {
  page?: number;
  per_page?: number;
};

export type UserPayload = {
  username: string;
  email: string;
  full_name: string;
  password?: string;
  role: string;
  is_active?: boolean;
};

export const userService = {
  list(filters: UserFilters = {}): Promise<Paginated<User>> {
    return getList<User>("/users", { ...filters });
  },

  getById(userId: string | number): Promise<User | null> {
    return getOne<User>(`/users/${userId}`);
  },

  create(payload: UserPayload): Promise<User> {
    return bffRequest<User>("/users", { method: "POST", body: payload });
  },

  update(userId: string | number, payload: Partial<UserPayload>): Promise<User> {
    return bffRequest<User>(`/users/${userId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  resetPassword(userId: string | number, new_password: string): Promise<unknown> {
    return bffRequest(`/users/${userId}/reset-password`, {
      method: "POST",
      body: { new_password },
    });
  },

  /** Soft delete with a required reason (admin). */
  remove(userId: string | number, reason: string): Promise<unknown> {
    return bffRequest(`/users/${userId}`, {
      method: "DELETE",
      body: { reason },
    });
  },
};
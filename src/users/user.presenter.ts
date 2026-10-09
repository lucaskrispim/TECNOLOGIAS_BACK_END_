import type { User } from '../generated/pg'

export interface UserDto {
  id: number
  name: string
  email: string
  createdAt: string
  updatedAt: string
}

/** Lista explicita de campos: o hash da senha fica de fora por construcao. */
export function toApi(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

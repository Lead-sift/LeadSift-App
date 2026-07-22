export type Rol = "owner" | "admin" | "soporte" | "client_user";

export interface Perfil {
  id: string;
  rol: Rol;
  empresa_id: string | null;
  nombre: string | null;
  nif: string | null;
}

export const ROLES_INTERNOS: Rol[] = ["owner", "admin", "soporte"];

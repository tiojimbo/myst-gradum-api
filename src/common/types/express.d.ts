import { AuthPrincipal } from '../../modules/auth/types/auth-principal.type';
declare global {
  namespace Express {
    interface Request {
      user?: AuthPrincipal;
    }
  }
}
export {};

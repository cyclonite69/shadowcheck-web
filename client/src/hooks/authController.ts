/*
 * authController: bridge for non-React code to trigger auth actions from the
 * AuthProvider. AuthProvider calls setLogout() to register its logout handler.
 */

type LogoutFn = () => Promise<void>;

export const isAuthenticationRequest = (url: string): boolean => {
  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    return (
      pathname === '/auth' ||
      pathname.startsWith('/auth/') ||
      pathname === '/api/auth' ||
      pathname.startsWith('/api/auth/')
    );
  } catch {
    return false;
  }
};

class AuthController {
  private _logout: LogoutFn = async () => Promise.resolve();
  private unauthorizedInProgress = false;
  private unauthorizedPromise: Promise<void> | null = null;

  setLogout(fn: LogoutFn) {
    this._logout = fn;
  }

  async logout() {
    return this._logout();
  }

  async handleUnauthorized(url: string): Promise<boolean> {
    if (isAuthenticationRequest(url)) {
      return false;
    }

    if (!this.unauthorizedInProgress) {
      this.unauthorizedInProgress = true;
      const logout = this._logout;
      this.unauthorizedPromise = Promise.resolve()
        .then(() => logout())
        .catch(() => undefined);
    }

    await this.unauthorizedPromise;
    return true;
  }

  markAuthenticated() {
    this.unauthorizedInProgress = false;
    this.unauthorizedPromise = null;
  }
}

export const authController = new AuthController();
export default authController;

import { Request, Response, NextFunction, static as expressStatic } from 'express';
import { resolve, join } from 'path';
import { existsSync } from 'fs';

/**
 * Admin Console Static File Handler
 * Serves the React SPA from the admin-console/dist directory
 */
export class AdminConsoleHandler {
  private staticPath: string;
  private indexPath: string;

  constructor(adminConsolePath?: string) {
    this.staticPath = adminConsolePath || resolve(__dirname, '../../../admin-console/dist');
    this.indexPath = join(this.staticPath, 'index.html');
  }

  /**
   * Check if admin console build exists
   */
  isBuilt(): boolean {
    return existsSync(this.indexPath);
  }

  /**
   * Express middleware to serve static files
   */
  serveStatic() {
    if (!this.isBuilt()) {
      console.warn('Admin console not built. Run build in admin-console/ directory.');
      return (req: Request, res: Response) => {
        res.status(503).json({ 
          error: 'Admin console not available',
          message: 'Admin console is not built. Please build the admin-console application.' 
        });
      };
    }

    return expressStatic(this.staticPath, {
      index: false,
      maxAge: '1d',
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    });
  }

  /**
   * Express middleware to handle SPA routing
   */
  serveSPA() {
    return (req: Request, res: Response, _next: NextFunction) => {
      if (!this.isBuilt()) {
        res.status(503).json({ 
          error: 'Admin console not available',
          message: 'Admin console is not built. Please build the admin-console application.' 
        });
        return;
      }

      res.sendFile(this.indexPath);
    };
  }
}

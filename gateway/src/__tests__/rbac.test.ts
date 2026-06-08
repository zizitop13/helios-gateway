import { RBACManager } from '../rbac';
import { buildSchema, parse } from 'graphql';

describe('RBACManager', () => {
  beforeEach(() => {
    RBACManager.clearPolicies();
  });

  describe('hasRequiredRoles', () => {
    it('should return true when user has all required roles (match: ALL)', () => {
      const userRoles = ['user', 'admin', 'editor'];
      const requiredRoles = ['user', 'admin'];
      const result = RBACManager.hasRequiredRoles(userRoles, requiredRoles, 'ALL');
      expect(result).toBe(true);
    });

    it('should return false when user is missing a required role (match: ALL)', () => {
      const userRoles = ['user'];
      const requiredRoles = ['user', 'admin'];
      const result = RBACManager.hasRequiredRoles(userRoles, requiredRoles, 'ALL');
      expect(result).toBe(false);
    });

    it('should return true when user has at least one required role (match: ANY)', () => {
      const userRoles = ['user'];
      const requiredRoles = ['user', 'admin'];
      const result = RBACManager.hasRequiredRoles(userRoles, requiredRoles, 'ANY');
      expect(result).toBe(true);
    });

    it('should return false when user has no required roles (match: ANY)', () => {
      const userRoles = ['viewer'];
      const requiredRoles = ['user', 'admin'];
      const result = RBACManager.hasRequiredRoles(userRoles, requiredRoles, 'ANY');
      expect(result).toBe(false);
    });

    it('should return false when user has no roles', () => {
      const userRoles: string[] = [];
      const requiredRoles = ['user'];
      const result = RBACManager.hasRequiredRoles(userRoles, requiredRoles, 'ANY');
      expect(result).toBe(false);
    });

    it('should default to ANY match when not specified', () => {
      const userRoles = ['admin'];
      const requiredRoles = ['user', 'admin'];
      const result = RBACManager.hasRequiredRoles(userRoles, requiredRoles);
      expect(result).toBe(true);
    });

    it('should return false when required roles list is empty (match: ALL)', () => {
      const userRoles = ['admin'];
      const requiredRoles: string[] = [];
      const result = RBACManager.hasRequiredRoles(userRoles, requiredRoles, 'ALL');
      expect(result).toBe(false);
    });

    it('should normalize role values before matching', () => {
      const userRoles = [' admin ', 'admin', '', '   ', 'user'];
      const requiredRoles = ['admin'];
      const result = RBACManager.hasRequiredRoles(userRoles, requiredRoles, 'ANY');
      expect(result).toBe(true);
    });
  });

  describe('validateOperationRoles', () => {
    const schema = buildSchema(`
      type AdminPayload {
        data: String!
      }

      type Query {
        publicData: String!
        adminData: String!
        adminPayload: AdminPayload!
      }
    `);

    beforeEach(() => {
      RBACManager.registerPoliciesFromSDL(`
        enum RoleMatch {
          ANY
          ALL
        }

        directive @allowAnonymous on FIELD_DEFINITION | OBJECT

        directive @requiresRole(
          roles: [String!]!
          match: RoleMatch = ANY
        ) on FIELD_DEFINITION | OBJECT

        type AdminPayload @requiresRole(roles: ["admin"]) {
          data: String!
        }

        type Query {
          publicData: String! @allowAnonymous
          adminData: String! @requiresRole(roles: ["admin"])
          adminPayload: AdminPayload!
        }
      `);
    });

    it('should allow anonymous queries only for allowAnonymous fields', () => {
      const document = parse(`
        query {
          publicData
        }
      `);

      expect(() =>
        RBACManager.validateOperationRoles(schema, document, [], false)
      ).not.toThrow();
    });

    it('should reject anonymous access by default when field is not allowAnonymous', () => {
      const document = parse(`
        query {
          adminData
        }
      `);

      expect(() =>
        RBACManager.validateOperationRoles(schema, document, [], false)
      ).toThrow('Authentication required');
    });

    it('should reject field-level restricted access without required role for authenticated users', () => {
      const document = parse(`
        query {
          adminData
        }
      `);

      expect(() =>
        RBACManager.validateOperationRoles(schema, document, ['user'], true)
      ).toThrow('Access denied');
    });

    it('should reject object-level restricted access without required role for authenticated users', () => {
      const document = parse(`
        query {
          adminPayload {
            data
          }
        }
      `);

      expect(() =>
        RBACManager.validateOperationRoles(schema, document, ['user'], true)
      ).toThrow('Access denied');
    });

    it('should allow restricted access with required role', () => {
      const document = parse(`
        query {
          adminData
          adminPayload {
            data
          }
        }
      `);

      expect(() =>
        RBACManager.validateOperationRoles(schema, document, ['admin'], true)
      ).not.toThrow();
    });

    it('should enforce policies loaded from subgraph SDL even when API schema has no directives', () => {
      const apiSchemaWithoutDirective = buildSchema(`
        type Query {
          pets: [String!]!
        }
      `);

      RBACManager.registerPoliciesFromSDL(`
        enum RoleMatch {
          ANY
          ALL
        }

        directive @allowAnonymous on FIELD_DEFINITION | OBJECT

        directive @requiresRole(
          roles: [String!]!
          match: RoleMatch = ANY
        ) on FIELD_DEFINITION | OBJECT

        type Query {
          pets: [String!]! @requiresRole(roles: ["viewer"], match: ANY)
        }
      `);

      const document = parse(`
        query {
          pets
        }
      `);

      expect(() =>
        RBACManager.validateOperationRoles(apiSchemaWithoutDirective, document, [], false)
      ).toThrow('Authentication required');

      expect(() =>
        RBACManager.validateOperationRoles(apiSchemaWithoutDirective, document, ['viewer'], true)
      ).not.toThrow();
    });
  });
});

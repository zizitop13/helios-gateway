import { ApolloServerPlugin } from '@apollo/server';
import {
  DirectiveNode,
  DocumentNode,
  GraphQLError,
  GraphQLSchema,
  Kind,
  parse,
  TypeInfo,
  valueFromASTUntyped,
  visit,
  visitWithTypeInfo,
} from 'graphql';
import { ApolloCloudContext, RequiresRoleDirectiveArgs } from '../types';

/**
 * RBAC Manager
 * Enforces role checks from policies loaded from subgraph SDL at startup.
 */
export class RBACManager {
  private static fieldPolicies = new Map<string, RequiresRoleDirectiveArgs>();
  private static typePolicies = new Map<string, RequiresRoleDirectiveArgs>();
  private static anonymousFieldPolicies = new Set<string>();
  private static anonymousTypePolicies = new Set<string>();

  private static parseRequiresRoleDirective(
    directiveNode: DirectiveNode | undefined
  ): RequiresRoleDirectiveArgs | undefined {
    if (!directiveNode) {
      return undefined;
    }

    const rolesArg = directiveNode.arguments?.find(
      (arg: { name?: { value?: string } }) => arg.name?.value === 'roles'
    );
    const matchArg = directiveNode.arguments?.find(
      (arg: { name?: { value?: string } }) => arg.name?.value === 'match'
    );

    const rolesValue = rolesArg?.value ? valueFromASTUntyped(rolesArg.value) : [];
    const matchValue = matchArg?.value?.kind === Kind.ENUM ? matchArg.value.value : 'ANY';

    return {
      roles: Array.isArray(rolesValue) ? rolesValue.filter((role) => typeof role === 'string') : [],
      match: matchValue === 'ALL' ? 'ALL' : 'ANY',
    };
  }

  static clearPolicies(): void {
    RBACManager.fieldPolicies.clear();
    RBACManager.typePolicies.clear();
    RBACManager.anonymousFieldPolicies.clear();
    RBACManager.anonymousTypePolicies.clear();
  }

  static getAvailableRoles(): string[] {
    const roleSet = new Set<string>();

    for (const policy of RBACManager.typePolicies.values()) {
      for (const role of policy.roles) {
        const normalized = role.trim();
        if (normalized) {
          roleSet.add(normalized);
        }
      }
    }

    for (const policy of RBACManager.fieldPolicies.values()) {
      for (const role of policy.roles) {
        const normalized = role.trim();
        if (normalized) {
          roleSet.add(normalized);
        }
      }
    }

    return [...roleSet].sort((a, b) => a.localeCompare(b));
  }

  /** Prepare a complete policy set without changing authorization for in-flight requests. */
  static preparePolicyUpdate(sdls: string[]): () => void {
    const policies = {
      fieldPolicies: new Map<string, RequiresRoleDirectiveArgs>(),
      typePolicies: new Map<string, RequiresRoleDirectiveArgs>(),
      anonymousFieldPolicies: new Set<string>(),
      anonymousTypePolicies: new Set<string>(),
    };
    for (const sdl of sdls) {
      RBACManager.registerDocumentPolicies(parse(sdl), policies);
    }
    return () => {
      RBACManager.fieldPolicies = policies.fieldPolicies;
      RBACManager.typePolicies = policies.typePolicies;
      RBACManager.anonymousFieldPolicies = policies.anonymousFieldPolicies;
      RBACManager.anonymousTypePolicies = policies.anonymousTypePolicies;
    };
  }

  static registerPoliciesFromSDL(sdl: string): void {
    RBACManager.registerDocumentPolicies(parse(sdl), {
      fieldPolicies: RBACManager.fieldPolicies,
      typePolicies: RBACManager.typePolicies,
      anonymousFieldPolicies: RBACManager.anonymousFieldPolicies,
      anonymousTypePolicies: RBACManager.anonymousTypePolicies,
    });
  }

  private static registerDocumentPolicies(document: DocumentNode, policies: {
    fieldPolicies: Map<string, RequiresRoleDirectiveArgs>;
    typePolicies: Map<string, RequiresRoleDirectiveArgs>;
    anonymousFieldPolicies: Set<string>;
    anonymousTypePolicies: Set<string>;
  }): void {
    for (const definition of document.definitions) {
      if (
        definition.kind !== Kind.OBJECT_TYPE_DEFINITION &&
        definition.kind !== Kind.OBJECT_TYPE_EXTENSION
      ) {
        continue;
      }

      const typeName = definition.name.value;
      const typeDirectiveNode = definition.directives?.find(
        (directive) => directive.name.value === 'requiresRole'
      );
      const typeDirective = RBACManager.parseRequiresRoleDirective(typeDirectiveNode);
      if (typeDirective) {
        policies.typePolicies.set(typeName, typeDirective);
      }
      const allowAnonymousOnType = definition.directives?.some(
        (directive) => directive.name.value === 'allowAnonymous'
      );
      if (allowAnonymousOnType) {
        policies.anonymousTypePolicies.add(typeName);
      }

      const fields = definition.fields || [];
      for (const field of fields) {
        const fieldDirectiveNode = field.directives?.find(
          (directive) => directive.name.value === 'requiresRole'
        );
        const fieldDirective = RBACManager.parseRequiresRoleDirective(fieldDirectiveNode);
        if (fieldDirective) {
          policies.fieldPolicies.set(`${typeName}.${field.name.value}`, fieldDirective);
        }

        const allowAnonymousOnField = field.directives?.some(
          (directive) => directive.name.value === 'allowAnonymous'
        );
        if (allowAnonymousOnField) {
          policies.anonymousFieldPolicies.add(`${typeName}.${field.name.value}`);
        }
      }
    }
  }

  private static normalizeRoles(roles: unknown): string[] {
    if (!Array.isArray(roles)) {
      return [];
    }

    const normalizedRoles = roles
      .map((role) => (typeof role === 'string' ? role.trim() : ''))
      .filter((role) => role.length > 0);

    return [...new Set(normalizedRoles)];
  }

  /**
   * Check if user has required roles based on match type
   * @param userRoles - Roles assigned to the user
   * @param requiredRoles - Roles required by the directive
   * @param match - Match type: ANY (at least one role) or ALL (all roles)
   */
  static hasRequiredRoles(
    userRoles: string[],
    requiredRoles: string[],
    match: 'ANY' | 'ALL' = 'ANY'
  ): boolean {
    const normalizedRequiredRoles = RBACManager.normalizeRoles(requiredRoles);
    const normalizedUserRoles = RBACManager.normalizeRoles(userRoles);

    if (normalizedRequiredRoles.length === 0) {
      return false;
    }

    if (normalizedUserRoles.length === 0) {
      return false;
    }

    if (match === 'ALL') {
      return normalizedRequiredRoles.every((role) => normalizedUserRoles.includes(role));
    }

    return normalizedRequiredRoles.some((role) => normalizedUserRoles.includes(role));
  }

  private static enforcePolicy(
    location: string,
    policy: RequiresRoleDirectiveArgs | undefined,
    userRoles: string[]
  ): void {
    if (!policy) {
      return;
    }

    if (!RBACManager.hasRequiredRoles(userRoles, policy.roles, policy.match)) {
      throw new GraphQLError(
        `Access denied to ${location}. Required roles: ${policy.roles.join(', ')} (match: ${policy.match})`,
        {
          extensions: {
            code: 'FORBIDDEN',
            http: { status: 403 },
          },
        }
      );
    }
  }

  private static enforceAuthentication(
    location: string,
    isAuthenticated: boolean,
    allowsAnonymous: boolean
  ): void {
    if (isAuthenticated || allowsAnonymous) {
      return;
    }

    throw new GraphQLError(`Authentication required for ${location}`, {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    });
  }

  static validateOperationRoles(
    schema: GraphQLSchema,
    document: DocumentNode,
    userRoles: string[],
    isAuthenticated: boolean
  ): void {
    const typeInfo = new TypeInfo(schema);

    visit(
      document,
      visitWithTypeInfo(typeInfo, {
        Field(node) {
          const parentType = typeInfo.getParentType();
          if (!parentType) {
            return;
          }

          const typeName = parentType.name;
          const fieldName = node.name.value;
          const fieldPolicyKey = `${typeName}.${fieldName}`;
          const allowsAnonymous =
            RBACManager.anonymousTypePolicies.has(typeName) ||
            RBACManager.anonymousFieldPolicies.has(fieldPolicyKey);

          RBACManager.enforceAuthentication(fieldPolicyKey, isAuthenticated, allowsAnonymous);
          RBACManager.enforcePolicy(typeName, RBACManager.typePolicies.get(typeName), userRoles);
          RBACManager.enforcePolicy(
            fieldPolicyKey,
            RBACManager.fieldPolicies.get(fieldPolicyKey),
            userRoles
          );
        },
        InlineFragment() {
          const parentType = typeInfo.getParentType();
          if (!parentType) {
            return;
          }

          const typeName = parentType.name;
          const allowsAnonymous = RBACManager.anonymousTypePolicies.has(typeName);
          RBACManager.enforceAuthentication(typeName, isAuthenticated, allowsAnonymous);
          RBACManager.enforcePolicy(
            typeName,
            RBACManager.typePolicies.get(typeName),
            userRoles
          );
        },
      })
    );
  }

  static createApolloPlugin(): ApolloServerPlugin<ApolloCloudContext> {
    return {
      async requestDidStart() {
        return {
          async didResolveOperation(requestContext) {
            const userRoles = requestContext.contextValue.user?.roles || [];
            const isAuthenticated = Boolean(requestContext.contextValue.user?.uid);
            RBACManager.validateOperationRoles(
              requestContext.schema,
              requestContext.document,
              userRoles,
              isAuthenticated
            );
          },
        };
      },
    };
  }
}

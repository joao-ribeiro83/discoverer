import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import {
  folders,
  securityPolicies,
  securityPolicyAssignments,
  securityPolicyRules,
  users,
  type SecurityPolicy,
  type SecurityPolicyAssignment,
  type SecurityPolicyRule,
} from '../db/schema.js';
import {
  validatePredicate,
} from '../lib/sql/security-predicates.js';

export { validatePredicate } from '../lib/sql/security-predicates.js';

/**
 * Row-level security policies.
 *
 * A policy holds rules (SQL predicates targeting a business area or folder)
 * and assignments (to users and/or roles). At query time
 * `map-execution.service.ts` resolves the executing user's active policies and
 * hands the applicable rule predicates to the SQL generator, which ANDs them
 * into the WHERE clause — see `resolveSecurityPredicates` there.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type SecurityPolicyErrorKind = 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT';

export class SecurityPolicyError extends Error {
  constructor(
    public kind: SecurityPolicyErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SecurityPolicyError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PolicyTargetType = 'BUSINESS_AREA' | 'FOLDER';

const USER_ROLES = ['ADMIN', 'MANAGER', 'USER', 'VIEWER'] as const;
export type UserRoleName = (typeof USER_ROLES)[number];

export interface PolicyRuleInput {
  targetId: string;
  targetType: PolicyTargetType;
  sqlPredicate: string;
}

export interface CreatePolicyInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
  rules: PolicyRuleInput[];
}

export interface UpdatePolicyInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  /** When present, replaces the policy's rules wholesale. */
  rules?: PolicyRuleInput[];
}

export interface PolicyWithRules extends SecurityPolicy {
  rules: SecurityPolicyRule[];
}

export interface PolicySummary extends SecurityPolicy {
  ruleCount: number;
  assignmentCount: number;
}

export interface AssignmentWithUser extends SecurityPolicyAssignment {
  userEmail: string | null;
  userName: string | null;
}

// ---------------------------------------------------------------------------
// Rule validation
// ---------------------------------------------------------------------------

function assertValidRules(rules: PolicyRuleInput[]): void {
  if (rules.length === 0) {
    throw new SecurityPolicyError(
      'VALIDATION',
      'A policy needs at least one rule',
    );
  }
  rules.forEach((rule, index) => {
    const check = validatePredicate(rule.sqlPredicate, {
      // Only a folder-targeted rule has a single folder to resolve {alias}
      // against; business-area rules must be self-contained.
      allowAliasToken: rule.targetType === 'FOLDER',
    });
    if (!check.valid) {
      throw new SecurityPolicyError(
        'VALIDATION',
        `Rule ${index + 1}: ${check.error}`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Policy CRUD
// ---------------------------------------------------------------------------

export async function listPolicies(): Promise<PolicySummary[]> {
  const [policies, rules, assignments] = await Promise.all([
    db.select().from(securityPolicies).orderBy(asc(securityPolicies.name)),
    db.select().from(securityPolicyRules),
    db.select().from(securityPolicyAssignments),
  ]);

  const ruleCounts = new globalThis.Map<string, number>();
  for (const rule of rules) {
    ruleCounts.set(rule.policyId, (ruleCounts.get(rule.policyId) ?? 0) + 1);
  }
  const assignmentCounts = new globalThis.Map<string, number>();
  for (const assignment of assignments) {
    assignmentCounts.set(
      assignment.policyId,
      (assignmentCounts.get(assignment.policyId) ?? 0) + 1,
    );
  }

  return policies.map((p) => ({
    ...p,
    ruleCount: ruleCounts.get(p.id) ?? 0,
    assignmentCount: assignmentCounts.get(p.id) ?? 0,
  }));
}

export async function getPolicy(id: string): Promise<PolicyWithRules | null> {
  const [policy] = await db
    .select()
    .from(securityPolicies)
    .where(eq(securityPolicies.id, id))
    .limit(1);
  if (!policy) return null;

  const rules = await db
    .select()
    .from(securityPolicyRules)
    .where(eq(securityPolicyRules.policyId, id))
    .orderBy(asc(securityPolicyRules.createdAt));

  return { ...policy, rules };
}

export async function createPolicy(
  data: CreatePolicyInput,
): Promise<PolicyWithRules> {
  assertValidRules(data.rules);

  const policyId = await db.transaction(async (tx) => {
    const [policy] = await tx
      .insert(securityPolicies)
      .values({
        name: data.name,
        description: data.description ?? null,
        policyType: 'ROW_LEVEL',
        isActive: data.isActive ?? true,
      })
      .returning();
    await tx.insert(securityPolicyRules).values(
      data.rules.map((rule) => ({
        policyId: policy!.id,
        targetId: rule.targetId,
        targetType: rule.targetType,
        sqlPredicate: rule.sqlPredicate.trim(),
      })),
    );
    return policy!.id;
  });

  return (await getPolicy(policyId))!;
}

export async function updatePolicy(
  id: string,
  data: UpdatePolicyInput,
): Promise<PolicyWithRules | null> {
  const existing = await getPolicy(id);
  if (!existing) return null;

  if (data.rules) assertValidRules(data.rules);

  await db.transaction(async (tx) => {
    const patch: Partial<typeof securityPolicies.$inferInsert> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    if (Object.keys(patch).length > 0) {
      await tx
        .update(securityPolicies)
        .set(patch)
        .where(eq(securityPolicies.id, id));
    }
    if (data.rules) {
      await tx
        .delete(securityPolicyRules)
        .where(eq(securityPolicyRules.policyId, id));
      await tx.insert(securityPolicyRules).values(
        data.rules.map((rule) => ({
          policyId: id,
          targetId: rule.targetId,
          targetType: rule.targetType,
          sqlPredicate: rule.sqlPredicate.trim(),
        })),
      );
    }
  });

  return getPolicy(id);
}

export async function deletePolicy(id: string): Promise<boolean> {
  // Rules and assignments cascade via their FKs.
  const [row] = await db
    .delete(securityPolicies)
    .where(eq(securityPolicies.id, id))
    .returning({ id: securityPolicies.id });
  return !!row;
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export async function listAssignments(
  policyId: string,
): Promise<AssignmentWithUser[]> {
  const rows = await db
    .select({
      id: securityPolicyAssignments.id,
      policyId: securityPolicyAssignments.policyId,
      userId: securityPolicyAssignments.userId,
      roleName: securityPolicyAssignments.roleName,
      userEmail: users.email,
      userName: users.name,
    })
    .from(securityPolicyAssignments)
    .leftJoin(users, eq(securityPolicyAssignments.userId, users.id))
    .where(eq(securityPolicyAssignments.policyId, policyId));
  return rows;
}

export async function assignPolicy(
  policyId: string,
  userId?: string,
  roleName?: string,
): Promise<SecurityPolicyAssignment> {
  if ((userId ? 1 : 0) + (roleName ? 1 : 0) !== 1) {
    throw new SecurityPolicyError(
      'VALIDATION',
      'Assign to exactly one of a user or a role',
    );
  }
  if (roleName && !USER_ROLES.includes(roleName as UserRoleName)) {
    throw new SecurityPolicyError(
      'VALIDATION',
      `Unknown role "${roleName}" — expected one of ${USER_ROLES.join(', ')}`,
    );
  }

  const policy = await getPolicy(policyId);
  if (!policy) {
    throw new SecurityPolicyError('NOT_FOUND', 'Policy not found');
  }
  if (userId) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new SecurityPolicyError('NOT_FOUND', 'User not found');
    }
  }

  const duplicate = await db
    .select({ id: securityPolicyAssignments.id })
    .from(securityPolicyAssignments)
    .where(
      and(
        eq(securityPolicyAssignments.policyId, policyId),
        userId
          ? eq(securityPolicyAssignments.userId, userId)
          : isNull(securityPolicyAssignments.userId),
        roleName
          ? eq(securityPolicyAssignments.roleName, roleName)
          : isNull(securityPolicyAssignments.roleName),
      ),
    )
    .limit(1);
  if (duplicate.length > 0) {
    throw new SecurityPolicyError(
      'CONFLICT',
      'This assignment already exists',
    );
  }

  const [assignment] = await db
    .insert(securityPolicyAssignments)
    .values({
      policyId,
      userId: userId ?? null,
      roleName: roleName ?? null,
    })
    .returning();
  return assignment!;
}

export async function unassignPolicy(
  policyId: string,
  userId?: string,
  roleName?: string,
): Promise<boolean> {
  if ((userId ? 1 : 0) + (roleName ? 1 : 0) !== 1) {
    throw new SecurityPolicyError(
      'VALIDATION',
      'Unassign exactly one of a user or a role',
    );
  }
  const rows = await db
    .delete(securityPolicyAssignments)
    .where(
      and(
        eq(securityPolicyAssignments.policyId, policyId),
        userId
          ? eq(securityPolicyAssignments.userId, userId)
          : eq(securityPolicyAssignments.roleName, roleName!),
      ),
    )
    .returning({ id: securityPolicyAssignments.id });
  return rows.length > 0;
}

/** Route-facing variant: remove by assignment id, scoped to its policy. */
export async function removeAssignment(
  policyId: string,
  assignmentId: string,
): Promise<boolean> {
  const [row] = await db
    .delete(securityPolicyAssignments)
    .where(
      and(
        eq(securityPolicyAssignments.id, assignmentId),
        eq(securityPolicyAssignments.policyId, policyId),
      ),
    )
    .returning({ id: securityPolicyAssignments.id });
  return !!row;
}

// ---------------------------------------------------------------------------
// Resolution (used by the query pipeline)
// ---------------------------------------------------------------------------

/**
 * All ACTIVE policies that apply to a user — assigned to them directly or to
 * their role — with rules attached. The query pipeline matches rule targets
 * against the executing map's business area and folders.
 */
export async function getUserPolicies(
  userId: string,
  userRole: string,
): Promise<PolicyWithRules[]> {
  const assignmentRows = await db
    .select({ policyId: securityPolicyAssignments.policyId })
    .from(securityPolicyAssignments)
    .where(
      or(
        eq(securityPolicyAssignments.userId, userId),
        eq(securityPolicyAssignments.roleName, userRole),
      ),
    );
  const policyIds = [...new Set(assignmentRows.map((a) => a.policyId))];
  if (policyIds.length === 0) return [];

  const policies = await db
    .select()
    .from(securityPolicies)
    .where(
      and(
        inArray(securityPolicies.id, policyIds),
        eq(securityPolicies.isActive, true),
      ),
    )
    .orderBy(asc(securityPolicies.name));
  if (policies.length === 0) return [];

  const rules = await db
    .select()
    .from(securityPolicyRules)
    .where(
      inArray(
        securityPolicyRules.policyId,
        policies.map((p) => p.id),
      ),
    )
    .orderBy(asc(securityPolicyRules.createdAt));

  const rulesByPolicy = new globalThis.Map<string, SecurityPolicyRule[]>();
  for (const rule of rules) {
    const list = rulesByPolicy.get(rule.policyId) ?? [];
    list.push(rule);
    rulesByPolicy.set(rule.policyId, list);
  }

  return policies.map((p) => ({ ...p, rules: rulesByPolicy.get(p.id) ?? [] }));
}

// ---------------------------------------------------------------------------
// Fail-closed (D-090)
// ---------------------------------------------------------------------------

/**
 * Why row-level security refuses a query over `folderIds`, or null when it may
 * run. `covered` holds the folders the executing user resolved at least one
 * predicate for. Map execution and the list-of-values path both ask here, so
 * the two cannot drift apart.
 *
 * Two refusals, checked in this order:
 *
 * 1. **A COMPLEX folder that any ACTIVE policy reaches (SEC-06).** Its custom
 *    SQL is inlined as a derived table, and a predicate is ANDed onto the query
 *    around it — never into the tables that SQL reads. Until a predicate can be
 *    proven injected there, the folder refuses for everyone, covered or not,
 *    and the refusal names the folder and the policy.
 *
 * 2. **A folder the user resolved no predicate for (D-090).** Under
 *    `ROW_LEVEL_FAIL_MODE=CLOSED`, the default, every such folder refuses: no
 *    policy means no rows, so removing, disabling or unassigning a policy can
 *    only ever take rows away. Discoverer's row-level security failed open by
 *    construction; this is Neo's one deliberate incompatibility with it.
 *    `OPEN` keeps only D-116's rule — refuse a folder some ACTIVE policy
 *    reaches, run every other folder unfiltered — so under `OPEN` disabling a
 *    policy does widen access.
 *
 * Together they make a COMPLEX folder unreadable under `CLOSED`: without a
 * policy it is uncovered, and with one it refuses. That is the honest position
 * until predicates reach inside custom SQL.
 *
 * Admins are exempt from neither. They bypass the grant gate; which rows they
 * may see is a separate question, and a policy an admin silently escaped would
 * be no policy at all.
 */
export async function rowSecurityRefusal(
  folderIds: string[],
  baByFolder: globalThis.Map<string, string[]>,
  covered: ReadonlySet<string>,
): Promise<string | null> {
  if (folderIds.length === 0) return null;

  const rows = await db
    .select({ id: folders.id, name: folders.name, folderType: folders.folderType })
    .from(folders)
    .where(inArray(folders.id, folderIds));
  const nameOf = (id: string) => rows.find((f) => f.id === id)?.name ?? id;
  const complex = rows.filter((f) => f.folderType === 'COMPLEX').map((f) => f.id);
  const open = config.ROW_LEVEL_FAIL_MODE === 'OPEN';

  let blocked = folderIds.filter((id) => !covered.has(id));
  const probe = [...new Set([...complex, ...(open ? blocked : [])])];
  const reached =
    probe.length > 0
      ? await policiesReaching(probe, baByFolder)
      : new globalThis.Map<string, string[]>();

  for (const id of complex) {
    const policies = reached.get(id);
    if (policies) {
      const label = policies.map((name) => `"${name}"`).join(', ');
      return (
        `Refusing to run: COMPLEX folder "${nameOf(id)}" is covered by row-level security ` +
        `${policies.length === 1 ? 'policy' : 'policies'} ${label}, and a policy's predicate ` +
        "cannot yet be proven to filter the rows a COMPLEX folder's own SQL reads"
      );
    }
  }

  if (open) blocked = blocked.filter((id) => reached.has(id));
  if (blocked.length === 0) return null;
  const label = blocked.map((id) => `"${nameOf(id)}"`).join(', ');
  return `Refusing to run unfiltered: no row-level security policy resolves for you on folder(s) ${label}`;
}

/**
 * The names of the ACTIVE policies reaching each folder — through a rule on the
 * folder itself or on a business area it belongs to. A folder no active policy
 * reaches is absent from the result.
 */
async function policiesReaching(
  folderIds: string[],
  baByFolder: globalThis.Map<string, string[]>,
): Promise<globalThis.Map<string, string[]>> {
  const targetsOf = (folderId: string) => [folderId, ...(baByFolder.get(folderId) ?? [])];
  const rows = await db
    .select({ targetId: securityPolicyRules.targetId, name: securityPolicies.name })
    .from(securityPolicyRules)
    .innerJoin(securityPolicies, eq(securityPolicyRules.policyId, securityPolicies.id))
    .where(
      and(
        eq(securityPolicies.isActive, true),
        inArray(securityPolicyRules.targetId, [...new Set(folderIds.flatMap(targetsOf))]),
      ),
    );

  const reached = new globalThis.Map<string, string[]>();
  for (const folderId of folderIds) {
    const targets = new Set(targetsOf(folderId));
    const names = [...new Set(rows.filter((r) => targets.has(r.targetId)).map((r) => r.name))];
    if (names.length > 0) reached.set(folderId, names.sort());
  }
  return reached;
}

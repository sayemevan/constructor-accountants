/**
 * Project collaboration members & custom roles.
 *
 * Access to a project is granted by sharing that project's Google Spreadsheet
 * with a collaborator's Google account (Drive permission). The *custom* role
 * (what they are, e.g. architect) is recorded separately in the project's
 * hidden "Members" tab — Drive only knows editor/viewer, the app knows the rest.
 */

/** The only collaborator role: an invited client with read-only access. */
export type ProjectRole = "client";

/** Whether the invited collaborator has accepted (opened) the shared project. */
export type MemberStatus = "pending" | "accepted";

export interface ProjectMember {
  id: string;
  email: string;
  name: string;
  role: ProjectRole;
  status: MemberStatus;
  invitedAt: string;
}

export const PROJECT_ROLES: { value: ProjectRole; label: string }[] = [
  { value: "client", label: "Client" },
];

/**
 * Clients are always shared as read-only viewers at the Drive level, so there
 * are no edit roles.
 */
export function driveRoleForProjectRole(_role: ProjectRole): "writer" | "reader" {
  return "reader";
}

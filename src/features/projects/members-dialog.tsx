"use client";

import React, { useEffect, useState } from "react";
import { ConstructionProject } from "@/types/project";
import { ProjectMember } from "@/types/member";
import { useData } from "@/providers/data-provider";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Mail, ShieldCheck, Loader2, Trash2 } from "lucide-react";

interface MembersDialogProps {
  project: ConstructionProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MembersDialog({ project, open, onOpenChange }: MembersDialogProps) {
  const { loadMembers, inviteMember, revokeMember } = useData();

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setError(null);
    setEmail("");
    setName("");
    setLoadingMembers(true);
    loadMembers(project.id)
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load members"))
      .finally(() => setLoadingMembers(false));
  }, [open, project, loadMembers]);

  if (!project) return null;

  const canInvite = !!project.projectSpreadsheetId;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter the collaborator's Google email.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const member: ProjectMember = {
      id: `mem_${Date.now()}`,
      email: email.trim(),
      name: name.trim() || email.trim(),
      role: "client",
      status: "pending",
      invitedAt: new Date().toISOString(),
    };
    try {
      await inviteMember(project.id, member);
      setMembers((prev) => [...prev, member]);
      setEmail("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (member: ProjectMember) => {
    setError(null);
    try {
      await revokeMember(project.id, member.email);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke access");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-amber-500" />
          <span>Project Team & Access</span>
        </DialogTitle>
        <DialogDescription>
          Invite collaborators to <strong>{project.name}</strong>. They receive a Google
          invitation email and, on sign-in, can open this project via the picker.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {!canInvite && (
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-600 dark:text-amber-400">
            This project has no dedicated spreadsheet yet, so it can&apos;t be shared. Recreate the
            project to enable collaboration.
          </div>
        )}

        {/* Invite form */}
        <form onSubmit={handleInvite} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-3">
          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center">
            <UserPlus className="h-4 w-4 mr-1.5 text-emerald-500" />
            <span>Invite a client</span>
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                Google Email
              </label>
              <Input
                type="email"
                placeholder="person@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canInvite || submitting}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                Name (optional)
              </label>
              <Input
                placeholder="e.g. Jane Architect"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canInvite || submitting}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                Role
              </label>
              <div className="h-8 flex items-center px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/60">
                <Badge variant="outline" className="text-[10px]">Client (read-only)</Badge>
              </div>
            </div>
            <Button type="submit" size="sm" disabled={!canInvite || submitting} className="h-8 text-xs">
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  Send Invite
                </>
              )}
            </Button>
          </div>
        </form>

        {error && <p className="text-[11px] text-red-500">{error}</p>}

        {/* Members list */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
            <span>Current Members</span>
          </h4>

          {loadingMembers ? (
            <div className="flex items-center justify-center py-6 text-xs text-zinc-400">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <p className="text-[11px] text-zinc-400 py-4 text-center">
              No collaborators yet. Invite someone above.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{m.name}</span>
                    <span className="text-[10px] text-zinc-400">{m.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {m.role}
                    </Badge>
                    <Badge variant={m.status === "accepted" ? "success" : "secondary"} className="text-[10px] capitalize">
                      {m.status}
                    </Badge>
                    <button
                      onClick={() => handleRevoke(m)}
                      title="Revoke access"
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

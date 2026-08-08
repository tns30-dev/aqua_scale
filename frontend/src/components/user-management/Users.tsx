import { useEffect, useState } from "react";

import { apiService } from "../../services/api.service";
import type {
  // ActionControl,
  // FeatureAccess,
  Project,
  UserListItem,
} from "../../types";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { OnboardUserDialog } from "./OnboardUserDialog";
import { AccessManagementDialog } from "./AccessManagementDialog";
import { UpdateUserProfileDialog } from "./UpdateUserProfileDialog";

/**
 * Users admin panel (Part 3 — Phase 8).
 *
 *   Listing  — GET  /api/users        (backend hides platform_admin accounts)
 *   Onboard  — POST /api/users        (OnboardUserDialog — checkboxes dropped;
 *                                      server applies Phase 5 defaults)
 *   Access   — PUT  /api/users/<id>/access   (AccessManagementDialog — two-pane)
 *   Profile  — PATCH /api/users/<id>          (UpdateUserProfileDialog)
 *
 * Each user row now has TWO buttons — Access Management + Update Profile —
 * because Phase 4 split the "manage" surface into projects/access vs profile.
 */
export function Users() {
  // Data
  const [users, setUsers] = useState<UserListItem[]>([]);
  // const [features, setFeatures] = useState<FeatureAccess[]>([]);
  // const [actionControls, setActionControls] = useState<ActionControl[]>([]);
  // Full set of projects (admin-only /api/projects/all/) so admins can assign
  // any project when onboarding or editing access.
  const [allProjects, setAllProjects] = useState<Project[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog open-state. Each non-null = open for that user; null = closed.
  // Onboard dialog manages its own open state internally.
  const [selectedAccessUserId, setSelectedAccessUserId] = useState<
    string | null
  >(null);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<
    string | null
  >(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [u, p] = await Promise.all([
        apiService.getUsers(),
        apiService.getAllProjects(),
      ]);
      setUsers(u);
      // setFeatures(f);
      // setActionControls(a);
      setAllProjects(p);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div>
      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50 text-green-700">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Users ({users.length})</h3>
        <OnboardUserDialog
          projects={allProjects}
          onSuccess={() => {
            flashSuccess("User created successfully");
            fetchData();
          }}
        />
      </div>

      {/* Mobile: stacked cards (< sm). */}
      <div className="space-y-3 sm:hidden">
        {users.map((user) => (
          <Card key={user.userId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {user.firstName} {user.lastName}
              </CardTitle>
              <CardDescription className="break-all">
                {user.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 pb-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Role</span>
                <span className="text-right">{user.role}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Created</span>
                <span className="text-right">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2 pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAccessUserId(user.userId)}
              >
                Access Management
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedProfileUserId(user.userId)}
              >
                Update Profile
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Desktop: grid table (>= sm). */}
      <div className="hidden rounded-lg border sm:block">
        <div className="grid grid-cols-5 border-b bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground">
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Created</div>
          <div className="text-right">Actions</div>
        </div>
        {users.map((user) => (
          <div
            key={user.userId}
            className="grid grid-cols-5 border-b px-4 py-2.5 last:border-b-0"
          >
            <div className="text-sm">
              {user.firstName} {user.lastName}
            </div>
            <div
              className="truncate text-sm text-muted-foreground"
              title={user.email}
            >
              {user.email}
            </div>
            <div className="text-sm">{user.role}</div>
            <div className="text-sm text-muted-foreground">
              {new Date(user.createdAt).toLocaleDateString()}
            </div>
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAccessUserId(user.userId)}
              >
                Access Management
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProfileUserId(user.userId)}
              >
                Update Profile
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AccessManagementDialog
        userId={selectedAccessUserId}
        projects={allProjects}
        onClose={() => setSelectedAccessUserId(null)}
        onSuccess={() => {
          flashSuccess("Access updated successfully");
          fetchData();
        }}
      />

      <UpdateUserProfileDialog
        userId={selectedProfileUserId}
        onClose={() => setSelectedProfileUserId(null)}
        onSuccess={() => {
          flashSuccess("Profile updated successfully");
          fetchData();
        }}
      />
    </div>
  );
}

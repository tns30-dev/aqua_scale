import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { apiService } from "../../services/api.service";
import {
  adminUpdateUserProfileSchema,
  type AdminUpdateUserProfileValues,
} from "../../utils/schema";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Field } from "./shared";

type Props = {
  /** Non-null = open this dialog for that user; null = closed. */
  userId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

/**
 * Update Profile dialog (Part 3 — Phase 8, admin edits another user).
 *
 * Fields: firstName, lastName, mobileNumber, role. Email and password are
 * intentionally absent — admins do not reset other users' credentials from
 * this dialog. Sends PATCH /api/users/<id>; sending any subset is valid.
 *
 * Distinct from PATCH /api/auth/me for self-update.
 */
export function UpdateUserProfileDialog({ userId, onClose, onSuccess }: Props) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<AdminUpdateUserProfileValues>({
    resolver: zodResolver(adminUpdateUserProfileSchema),
    defaultValues: { firstName: "", lastName: "", mobileNumber: "", role: "" },
  });

  // Hydrate from the current user record so the admin can see what they're
  // editing (rather than blank fields that would clobber on partial submit).
  useEffect(() => {
    if (!userId) {
      setApiError(null);
      form.reset({ firstName: "", lastName: "", mobileNumber: "", role: "" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setApiError(null);
        const access = await apiService.getUserAccess(userId);
        if (cancelled) return;
        form.reset({
          firstName: access.firstName,
          lastName: access.lastName,
          mobileNumber: access.mobileNumber ?? "",
          role: access.role,
        });
      } catch {
        if (cancelled) return;
        setApiError("Failed to load user profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, form]);

  async function handleSubmit(values: AdminUpdateUserProfileValues) {
    if (!userId) return;
    try {
      setApiError(null);
      await apiService.updateUserProfile(userId, {
        firstName: values.firstName,
        lastName: values.lastName,
        mobileNumber: values.mobileNumber,
        role: values.role,
      });
      onClose();
      onSuccess();
    } catch {
      setApiError("Failed to update profile");
    }
  }

  return (
    <Dialog
      open={userId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Profile</DialogTitle>
          <DialogDescription>
            Edit name, mobile, and role. Email and password are not changed
            from this dialog.
          </DialogDescription>
        </DialogHeader>

        {apiError && (
          <Alert variant="destructive">
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        )}

        {!loading && (
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="profile-firstName"
                label="First name"
                register={form.register("firstName")}
                error={form.formState.errors.firstName?.message}
              />
              <Field
                id="profile-lastName"
                label="Last name"
                register={form.register("lastName")}
                error={form.formState.errors.lastName?.message}
              />
            </div>
            <Field
              id="profile-mobileNumber"
              label="Mobile number"
              register={form.register("mobileNumber")}
              error={form.formState.errors.mobileNumber?.message}
            />
            <Field
              id="profile-role"
              label="Role"
              register={form.register("role")}
              error={form.formState.errors.role?.message}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

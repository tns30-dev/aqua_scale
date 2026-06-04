import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { apiService } from "../../services/api.service";
import type { Project } from "../../types";
import {
  onboardFormSchema,
  type OnboardFormValues,
} from "../../utils/schema";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { CheckboxGroup, Field, toggleArrayValue } from "./shared";

type Props = {
  projects: Project[];
  onSuccess: () => void;
};

/**
 * Onboard a new user (Part 3 — Phase 8).
 *
 * Final field set: email, password, firstName, lastName, mobileNumber, role,
 * projectIds. The Part 2 module/feature checkbox grids are gone; the server
 * applies the curated default-access scope via `RBACService.get_default_access()`
 * when `featureActionAssigned` is omitted (Phase 5 behaviour). Fine-grained
 * access is granted later through AccessManagementDialog.
 */
export function OnboardUserDialog({ projects, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<OnboardFormValues>({
    resolver: zodResolver(onboardFormSchema),
    defaultValues: emptyOnboard(),
  });

  function openDialog() {
    form.reset(emptyOnboard());
    setApiError(null);
    setOpen(true);
  }

  async function handleSubmit(values: OnboardFormValues) {
    try {
      setApiError(null);
      // featureActionAssigned deliberately omitted — server hydrates defaults.
      await apiService.onboardUser(values);
      setOpen(false);
      onSuccess();
    } catch (err: unknown) {
      const data = (
        err as { response?: { data?: { email?: string | string[] } } }
      )?.response?.data;
      setApiError(
        data?.email
          ? Array.isArray(data.email)
            ? data.email[0]
            : data.email
          : "Failed to create user",
      );
    }
  }

  return (
    <>
      <Button onClick={openDialog} size="sm">
        + Onboard User
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Onboard New User</DialogTitle>
          </DialogHeader>

          {apiError && (
            <Alert variant="destructive">
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <Field
              id="email"
              label="Email"
              type="email"
              register={form.register("email")}
              error={form.formState.errors.email?.message}
            />
            <Field
              id="password"
              label="Password (min 8 chars)"
              type="password"
              register={form.register("password")}
              error={form.formState.errors.password?.message}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="firstName"
                label="First name"
                register={form.register("firstName")}
                error={form.formState.errors.firstName?.message}
              />
              <Field
                id="lastName"
                label="Last name"
                register={form.register("lastName")}
                error={form.formState.errors.lastName?.message}
              />
            </div>
            <Field
              id="role"
              label="Role"
              register={form.register("role")}
              error={form.formState.errors.role?.message}
            />
            <CheckboxGroup
              label="Projects"
              options={projects.map((p) => ({
                value: p.projectId,
                label: p.name,
              }))}
              selected={form.watch("projectIds")}
              onToggle={(pid) =>
                toggleArrayValue(form, "projectIds", pid)
              }
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function emptyOnboard(): OnboardFormValues {
  return {
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    mobileNumber: "",
    role: "user",
    projectIds: [],
  };
}

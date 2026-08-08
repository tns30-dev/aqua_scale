import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Input, Card, Toast, useTheme } from "../design-system";
import { useAuth } from "../hooks/useAuth";

/**
 * Login flow:
 *   submit → api.login() sets HttpOnly auth cookies
 *   → hydrate SessionContext from the response
 *   → set theme from projects[0]
 *   → navigate to /overview (or ?next= if present)
 *
 * No role picker — Part 2 users have a single text role.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error: authError } = useAuth();
  const { setTheme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);

  function getNextUrl() {
    const urlParams = new URLSearchParams(location.search);
    return urlParams.get("next") || "/overview";
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setShowErrorToast(true);
      return;
    }

    const response = await login({ email, password });

    if (!response) {
      setShowErrorToast(true);
      return;
    }

    // Set theme from the first project (if any) so the dashboard renders correctly.
    if (response.projects.length > 0) {
      setTheme(response.projects[0].profileType);
    }

    setShowSuccessToast(true);
    setTimeout(() => navigate(getNextUrl()), 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full mb-4">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to AquaShield
          </h1>
          <p className="text-gray-600">
            Sign in to monitor your aquaculture operations
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email"
            placeholder="admin@aquashield.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
          />

          <Input
            type="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{" "}
            <a
              href="/auth/signup"
              className="text-primary-500 hover:text-primary-600 font-medium"
            >
              Sign up
            </a>
          </p>
        </div>

        {/* Demo credentials hint */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            <strong>Local demo credentials:</strong>
            <br />
            Email: admin@aquashield.local
            <br />
            Password: AdminBoot123!
          </p>
        </div>
      </Card>

      {/* Toast Notifications */}
      <Toast
        message="Sign in successful! Redirecting..."
        open={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
        severity="success"
        duration={500}
      />

      <Toast
        message={authError || "Sign in failed. Please check your credentials."}
        open={showErrorToast}
        onClose={() => setShowErrorToast(false)}
        severity="error"
      />
    </div>
  );
}

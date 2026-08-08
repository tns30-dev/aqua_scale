import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import {
  MemoryRouter,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
import type { ReactElement, ReactNode } from "react";

import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../design-system";
import { LoginPage } from "../../pages/LoginPage";
import {
  createMockUseAuth,
  createMockUseLocation,
  createMockUseTheme,
  mockProjects,
  mockUser,
} from "../mocks";

// Helper types based on real hook return types
type UseAuthReturn = ReturnType<typeof useAuth>;
type ThemeContextReturn = ReturnType<typeof useTheme>;

// LoginPage doesn't consume ProfileContext or SessionContext directly, so
// the shared test-utils wrapper (MemoryRouter + ProfileProvider) is heavier
// than needed — ProfileProvider would force a SessionContext dependency we
// don't otherwise need. Use a lighter router-only wrapper instead.
function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    ),
  });
}

// --- Mocks ---

vi.mock("../../hooks/useAuth");

vi.mock("../../design-system", () => ({
  useTheme: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Button: ({ children, disabled, ...props }: any) => (
    <button disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Input: ({
    label,
    placeholder,
    value,
    onChange,
    type,
    ...props
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input
        type={type || "text"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        {...props}
      />
    </div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Toast: ({ message, open, severity }: any) =>
    open ? (
      <div role="alert">
        {severity === "error" ? "Login failed" : message}
      </div>
    ) : null,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
  };
});

// Part 2 useAuth.login resolves to MeResponse (`{ user, projects }`) — the
// LoginPage reads `response.projects` to set the theme and decide redirect.
const successfulLoginResponse = {
  user: mockUser,
  projects: mockProjects,
};

describe("LoginPage", () => {
  let mockNavigate: NavigateFunction;
  let mockLogin: ReturnType<typeof vi.fn>;
  let mockSetTheme: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();

    mockLogin = vi.fn();
    mockNavigate = vi.fn() as unknown as NavigateFunction;
    mockSetTheme = vi.fn();

    vi.mocked(useAuth).mockReturnValue(
      createMockUseAuth({ login: mockLogin }) as unknown as UseAuthReturn,
    );

    vi.mocked(useTheme).mockReturnValue(
      createMockUseTheme({
        setTheme: mockSetTheme,
      }) as unknown as ThemeContextReturn,
    );

    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useLocation).mockReturnValue(createMockUseLocation());
  });

  // --- Rendering ---

  describe("Rendering", () => {
    it("renders login form with email and password inputs", () => {
      render(<LoginPage />);
      expect(
        screen.getByPlaceholderText("admin@aquashield.local"),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Enter your password"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /sign in/i }),
      ).toBeInTheDocument();
    });

    it("displays welcome message and description", () => {
      render(<LoginPage />);
      expect(screen.getByText("Welcome to AquaShield")).toBeInTheDocument();
      expect(
        screen.getByText("Sign in to monitor your aquaculture operations"),
      ).toBeInTheDocument();
    });

    it("displays signup link", () => {
      render(<LoginPage />);
      const link = screen.getByRole("link", { name: /sign up/i });
      expect(link).toHaveAttribute("href", "/auth/signup");
    });

    it("does NOT render a role-picker modal (Part 2 removed it)", () => {
      render(<LoginPage />);
      expect(screen.queryByText(/select.*role/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/platform.admin/i)).not.toBeInTheDocument();
    });
  });

  // --- Form Validation ---

  describe("Form Validation", () => {
    it("does not submit when email is empty", async () => {
      render(<LoginPage />);
      await userEvent.type(
        screen.getByPlaceholderText("Enter your password"),
        "password123",
      );
      await userEvent.click(
        screen.getByRole("button", { name: /sign in/i }),
      );
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("does not submit when password is empty", async () => {
      render(<LoginPage />);
      await userEvent.type(
        screen.getByPlaceholderText("admin@aquashield.local"),
        "test@example.com",
      );
      await userEvent.click(
        screen.getByRole("button", { name: /sign in/i }),
      );
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  // --- Successful Login ---

  describe("Successful Login", () => {
    beforeEach(() => {
      mockLogin.mockResolvedValue(successfulLoginResponse);
    });

    it("calls useAuth.login with the entered credentials", async () => {
      render(<LoginPage />);
      await userEvent.type(
        screen.getByPlaceholderText("admin@aquashield.local"),
        "demo@aquaculture.com",
      );
      await userEvent.type(
        screen.getByPlaceholderText("Enter your password"),
        "demo123",
      );
      await userEvent.click(
        screen.getByRole("button", { name: /sign in/i }),
      );
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: "demo@aquaculture.com",
          password: "demo123",
        });
      });
    });

    it("sets theme from the first project's profileType", async () => {
      render(<LoginPage />);
      await userEvent.type(
        screen.getByPlaceholderText("admin@aquashield.local"),
        "demo@aquaculture.com",
      );
      await userEvent.type(
        screen.getByPlaceholderText("Enter your password"),
        "demo123",
      );
      await userEvent.click(
        screen.getByRole("button", { name: /sign in/i }),
      );
      await waitFor(() => {
        expect(mockSetTheme).toHaveBeenCalledWith("shrimp");
      });
    });

    it("does NOT write projects to localStorage (Phase 6.5 moved session to context + HttpOnly cookies)", async () => {
      render(<LoginPage />);
      await userEvent.type(
        screen.getByPlaceholderText("admin@aquashield.local"),
        "demo@aquaculture.com",
      );
      await userEvent.type(
        screen.getByPlaceholderText("Enter your password"),
        "demo123",
      );
      await userEvent.click(
        screen.getByRole("button", { name: /sign in/i }),
      );
      await waitFor(() => {
        expect(mockSetTheme).toHaveBeenCalled();
      });
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        "projects",
        expect.anything(),
      );
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        "token",
        expect.anything(),
      );
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        "user",
        expect.anything(),
      );
    });

    it("navigates to /overview by default after a short delay", async () => {
      render(<LoginPage />);
      await userEvent.type(
        screen.getByPlaceholderText("admin@aquashield.local"),
        "demo@aquaculture.com",
      );
      await userEvent.type(
        screen.getByPlaceholderText("Enter your password"),
        "demo123",
      );
      await userEvent.click(
        screen.getByRole("button", { name: /sign in/i }),
      );
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith("/overview");
        },
        { timeout: 2000 },
      );
    });

    it("respects ?next= query parameter for post-login redirect", async () => {
      vi.mocked(useLocation).mockReturnValue(
        createMockUseLocation({ search: "?next=/user-management/users" }),
      );
      render(<LoginPage />);
      await userEvent.type(
        screen.getByPlaceholderText("admin@aquashield.local"),
        "demo@aquaculture.com",
      );
      await userEvent.type(
        screen.getByPlaceholderText("Enter your password"),
        "demo123",
      );
      await userEvent.click(
        screen.getByRole("button", { name: /sign in/i }),
      );
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith("/user-management/users");
        },
        { timeout: 2000 },
      );
    });
  });

  // --- Failed Login ---

  describe("Failed Login", () => {
    it("does not navigate and shows the error toast when useAuth.login returns null", async () => {
      vi.mocked(useAuth).mockReturnValue(
        createMockUseAuth({
          login: mockLogin,
          error: "Login failed",
        }) as unknown as UseAuthReturn,
      );
      mockLogin.mockResolvedValue(null);

      render(<LoginPage />);
      await userEvent.type(
        screen.getByPlaceholderText("admin@aquashield.local"),
        "wrong@example.com",
      );
      await userEvent.type(
        screen.getByPlaceholderText("Enter your password"),
        "wrong123",
      );
      await userEvent.click(
        screen.getByRole("button", { name: /sign in/i }),
      );

      expect(mockNavigate).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Login failed");
      });
    });
  });

  // --- Loading State ---

  describe("Loading State", () => {
    it('disables button and shows "Signing in..." while useAuth.isLoading is true', () => {
      vi.mocked(useAuth).mockReturnValue(
        createMockUseAuth({
          login: mockLogin,
          isLoading: true,
        }) as unknown as UseAuthReturn,
      );
      render(<LoginPage />);
      const button = screen.getByRole("button", { name: /signing in/i });
      expect(button).toBeDisabled();
    });
  });
});

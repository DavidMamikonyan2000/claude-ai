import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-proj-1" } as never);
});

describe("useAuth — initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(typeof result.current.isLoading).toBe("boolean");
  });
});

describe("useAuth — signIn", () => {
  test("calls signInAction with the provided credentials", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }] as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("user@example.com", "password123"));

    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "password123");
  });

  test("returns the result from signInAction", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    let returned: Awaited<ReturnType<typeof result.current.signIn>>;
    await act(async () => {
      returned = await result.current.signIn("user@example.com", "wrong");
    });

    expect(returned!).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("sets isLoading to true during the call and false after", async () => {
    let loadingDuringCall = false;
    mockSignIn.mockImplementation(async () => {
      loadingDuringCall = true;
      return { success: false, error: "err" };
    });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(loadingDuringCall).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when signInAction throws", async () => {
    mockSignIn.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      try {
        await result.current.signIn("a@b.com", "pass");
      } catch {}
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not navigate when sign-in fails", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("useAuth — signUp", () => {
  test("calls signUpAction with the provided credentials", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }] as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signUp("new@example.com", "securepass"));

    expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "securepass");
  });

  test("returns the result from signUpAction", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    let returned: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      returned = await result.current.signUp("existing@example.com", "pass");
    });

    expect(returned!).toEqual({ success: false, error: "Email already registered" });
  });

  test("sets isLoading to true during the call and false after", async () => {
    let loadingDuringCall = false;
    mockSignUp.mockImplementation(async () => {
      loadingDuringCall = true;
      return { success: false, error: "err" };
    });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signUp("a@b.com", "pass"));

    expect(loadingDuringCall).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when signUpAction throws", async () => {
    mockSignUp.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      try {
        await result.current.signUp("a@b.com", "pass");
      } catch {}
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not navigate when sign-up fails", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signUp("a@b.com", "pass"));

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("useAuth — post sign-in navigation with anon work", () => {
  test("creates a project from anon work and navigates to it", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/App.jsx": { type: "file", content: "..." } },
    });
    mockCreateProject.mockResolvedValue({ id: "anon-proj-42" } as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
        data: { "/App.jsx": { type: "file", content: "..." } },
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-proj-42");
  });

  test("does not call getProjects when anon work is present", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "anon-proj-99" } as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("ignores anon work when messages array is empty", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }] as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockGetProjects).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });

  test("project name includes the current time", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "proj-t" } as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    const [callArg] = mockCreateProject.mock.calls[0];
    expect(callArg.name).toMatch(/^Design from /);
  });
});

describe("useAuth — post sign-in navigation without anon work", () => {
  test("navigates to the most recent existing project", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([
      { id: "recent-proj" },
      { id: "older-proj" },
    ] as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockPush).toHaveBeenCalledWith("/recent-proj");
  });

  test("creates a new project and navigates to it when user has no projects", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new" } as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new");
  });

  test("new project name matches the 'New Design #N' pattern", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new" } as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    const [callArg] = mockCreateProject.mock.calls[0];
    expect(callArg.name).toMatch(/^New Design #\d+$/);
  });

  test("does not call createProject when existing projects are found", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "existing" }] as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("a@b.com", "pass"));

    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

describe("useAuth — signUp post-auth navigation", () => {
  test("navigates after successful sign-up using the same post-auth logic", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-after-signup" }] as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signUp("new@example.com", "password123"));

    expect(mockPush).toHaveBeenCalledWith("/proj-after-signup");
  });

  test("handles anon work on sign-up the same way as sign-in", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: { "/App.tsx": { type: "file", content: "" } },
    });
    mockCreateProject.mockResolvedValue({ id: "signup-anon-proj" } as never);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signUp("new@example.com", "password123"));

    expect(mockCreateProject).toHaveBeenCalled();
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/signup-anon-proj");
  });
});

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { cleanupDialogArtifacts } from "@/lib/utils";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const mutateAsync = vi.fn();
vi.mock("@/hooks/useUsers", () => ({
  useDeleteUser: () => ({
    mutateAsync: (...args: any[]) => mutateAsync(...args),
    isPending: false,
  }),
}));

const user = {
  id: "user-1",
  email: "user@example.com",
  name: "Alex Doe",
  phone: "+12345678",
  role: "user" as const,
  status: "active" as const,
  created_at: "2024-01-01",
  updated_at: "2024-01-02",
  avatar_url: "",
};

describe("cleanupDialogArtifacts", () => {
  afterEach(() => {
    document.body.className = "";
    document.documentElement.className = "";
    document.body.removeAttribute("inert");
    document.documentElement.removeAttribute("inert");
    document.body.removeAttribute("aria-hidden");
    document.documentElement.removeAttribute("aria-hidden");
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    vi.clearAllMocks();
  });

  it("clears modal artifacts from DOM", () => {
    document.body.setAttribute("inert", "");
    document.body.setAttribute("aria-hidden", "true");
    document.documentElement.setAttribute("inert", "");
    document.documentElement.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("react-remove-scroll");
    document.documentElement.classList.add("react-remove-scroll");

    cleanupDialogArtifacts();

    expect(document.body.hasAttribute("inert")).toBe(false);
    expect(document.body.hasAttribute("aria-hidden")).toBe(false);
    expect(document.documentElement.hasAttribute("inert")).toBe(false);
    expect(document.documentElement.hasAttribute("aria-hidden")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.classList.contains("react-remove-scroll")).toBe(false);
    expect(document.documentElement.classList.contains("react-remove-scroll")).toBe(false);
  });
});

describe("DeleteUserDialog cleanup", () => {
  afterEach(() => {
    document.body.className = "";
    document.documentElement.className = "";
    document.body.removeAttribute("inert");
    document.documentElement.removeAttribute("inert");
    document.body.removeAttribute("aria-hidden");
    document.documentElement.removeAttribute("aria-hidden");
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    vi.clearAllMocks();
  });

  it("clears dialog artifacts after delete confirmation", async () => {
    mutateAsync.mockResolvedValue(undefined);
    document.body.setAttribute("inert", "");
    document.body.setAttribute("aria-hidden", "true");
    document.body.classList.add("react-remove-scroll");
    document.body.style.overflow = "hidden";

    render(
      <DeleteUserDialog open={true} onOpenChange={() => undefined} user={user} onSuccess={() => undefined} />
    );

    fireEvent.click(screen.getByRole("button", { name: "btn_delete", hidden: true }));

    await waitFor(() => {
      expect(document.body.hasAttribute("inert")).toBe(false);
      expect(document.body.hasAttribute("aria-hidden")).toBe(false);
      expect(document.body.style.overflow).toBe("");
      expect(document.body.classList.contains("react-remove-scroll")).toBe(false);
    });
  });
});

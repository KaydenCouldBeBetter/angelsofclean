import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const customerSignIn = vi.fn();
const customerSignUp = vi.fn();
const resendConfirmation = vi.fn();
const requestCustomerPasswordReset = vi.fn();
const updateCustomerPassword = vi.fn();
vi.mock("../actions", () => ({
  customerSignIn: (...a: unknown[]) => customerSignIn(...a),
  customerSignUp: (...a: unknown[]) => customerSignUp(...a),
  resendConfirmation: (...a: unknown[]) => resendConfirmation(...a),
  requestCustomerPasswordReset: (...a: unknown[]) => requestCustomerPasswordReset(...a),
  updateCustomerPassword: (...a: unknown[]) => updateCustomerPassword(...a),
}));

import LoginForm from "../login/LoginForm";
import SignupForm from "../signup/SignupForm";
import ForgotPasswordForm from "../forgot-password/ForgotPasswordForm";
import ResetPasswordForm from "../reset-password/ResetPasswordForm";

const TOKEN = "D".repeat(43);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  customerSignIn.mockResolvedValue({});
  customerSignUp.mockResolvedValue({ checkEmail: true });
  resendConfirmation.mockResolvedValue({});
  requestCustomerPasswordReset.mockResolvedValue({});
  updateCustomerPassword.mockResolvedValue({});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (ui: React.ReactElement) => act(() => root.render(ui));

function setValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const field = (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)!;
const labelFor = (id: string) => container.querySelector(`label[for="${id}"]`)?.textContent;
const linkTo = (href: string) => container.querySelector(`a[href="${href}"]`);
const button = (text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;
async function submit() {
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function click(el: Element) {
  await act(async () => {
    (el as HTMLElement).click();
  });
}

describe("LoginForm (Figma 120:899)", () => {
  it("has the Figma content: one h1, labelled fields, forgot password, guest and sign-up paths", () => {
    render(<LoginForm inviteToken={null} notice={null} />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("h1")!.textContent).toBe("Welcome back");
    expect(container.textContent).toContain("Sign in to manage your bookings.");
    expect(labelFor("email")).toBe("Email");
    expect(labelFor("password")).toBe("Password");
    expect(linkTo("/forgot-password")).not.toBeNull();
    expect(linkTo("/signup")?.textContent).toBe("Sign up");
    expect(linkTo("/")?.textContent).toBe("Continue as guest");
    expect(button("Sign In")).toBeDefined();
  });

  it("lets password managers fill it and never blocks paste", () => {
    render(<LoginForm inviteToken={null} notice={null} />);
    expect(field("email").autocomplete).toBe("email");
    expect(field("password").autocomplete).toBe("current-password");
    expect(field("password").type).toBe("password");
    expect(field("password").getAttribute("onpaste")).toBeNull();
  });

  it("signs in with what was typed and, when there is one, the invite token", async () => {
    render(<LoginForm inviteToken={TOKEN} notice={null} />);
    setValue(field("email"), "alice@example.com");
    setValue(field("password"), "hunter2hunter2");
    await submit();
    expect(customerSignIn).toHaveBeenCalledWith("alice@example.com", "hunter2hunter2", TOKEN);
  });

  it("explains an invite link and carries it to sign up", () => {
    render(<LoginForm inviteToken={TOKEN} notice={null} />);
    expect(container.textContent).toContain("invited to join a business account");
    expect(linkTo(`/signup?invite=${TOKEN}`)).not.toBeNull();
  });

  it("announces a failed sign-in as an alert and keeps the typed email", async () => {
    customerSignIn.mockResolvedValue({ error: "Invalid email or password." });
    render(<LoginForm inviteToken={null} notice={null} />);
    setValue(field("email"), "alice@example.com");
    setValue(field("password"), "wrong");
    await submit();
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Invalid email or password.");
    expect(field("email").value).toBe("alice@example.com");
  });

  it("offers to resend the link to someone who hasn't confirmed their email", async () => {
    customerSignIn.mockResolvedValue({ error: "Confirm your email first.", needsConfirmation: true });
    render(<LoginForm inviteToken={null} notice={null} />);
    setValue(field("email"), "alice@example.com");
    setValue(field("password"), "pw");
    await submit();
    await click(button("Send the link again"));
    expect(resendConfirmation).toHaveBeenCalledWith("alice@example.com");
    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/new link/i);
  });

  it("shows a notice from the page (icon and words, announced politely)", () => {
    render(<LoginForm inviteToken={null} notice="Log in again to continue." />);
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain("Log in again to continue.");
    expect(status?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("SignupForm (Figma 120:942)", () => {
  it("has the Figma content plus the home or business choice", () => {
    render(<SignupForm inviteToken={null} />);
    expect(container.querySelector("h1")!.textContent).toBe("Create your account");
    expect(labelFor("name")).toBe("Full name");
    expect(labelFor("email")).toBe("Email");
    expect(labelFor("password")).toBe("Password");
    expect(container.textContent).toContain("At least 8 characters");
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(linkTo("/terms")).not.toBeNull();
    expect(linkTo("/privacy")).not.toBeNull();
    expect(linkTo("/login")?.textContent).toBe("Sign in");
    expect(linkTo("/")?.textContent).toBe("Continue without an account");
  });

  it("asks a business for its business name", async () => {
    render(<SignupForm inviteToken={null} />);
    const business = container.querySelector<HTMLInputElement>('input[type="radio"][value="commercial"]')!;
    await click(business);
    expect(labelFor("name")).toBe("Business name");
    expect(field("name").autocomplete).toBe("organization");
  });

  it("hides the account type for an invited coworker and keeps the invite on the sign-in link", () => {
    render(<SignupForm inviteToken={TOKEN} />);
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    expect(container.textContent).toContain("invited to join a business account");
    expect(linkTo(`/login?invite=${TOKEN}`)).not.toBeNull();
  });

  it("marks empty and short fields invalid, names the problem, and sends nothing", async () => {
    render(<SignupForm inviteToken={null} />);
    setValue(field("email"), "nope");
    setValue(field("password"), "short");
    await submit();
    expect(customerSignUp).not.toHaveBeenCalled();
    for (const [id, text] of [
      ["name", "Full name is required."],
      ["email", "Please enter a valid email address."],
      ["password", "Use at least 8 characters."],
    ]) {
      expect(field(id).getAttribute("aria-invalid")).toBe("true");
      const errorId = field(id).getAttribute("aria-describedby")!.split(" ").find((d) => d.endsWith("-error"))!;
      expect(container.querySelector(`#${errorId}`)?.textContent).toBe(text);
      expect(container.querySelector(`#${errorId}`)?.getAttribute("role")).toBe("alert");
    }
  });

  it("submits the account details with a bot check from an untouched honeypot", async () => {
    render(<SignupForm inviteToken={null} />);
    setValue(field("name"), "Alice Adams");
    setValue(field("email"), "alice@example.com");
    setValue(field("password"), "correct horse");
    await submit();
    expect(customerSignUp).toHaveBeenCalledTimes(1);
    const input = customerSignUp.mock.calls[0][0];
    expect(input).toMatchObject({
      name: "Alice Adams",
      email: "alice@example.com",
      password: "correct horse",
      accountType: "residential",
      inviteToken: null,
    });
    expect(input.botCheck.website).toBe("");
    expect(typeof input.botCheck.elapsedMs).toBe("number");
  });

  it("hides the honeypot from people and assistive tech", () => {
    render(<SignupForm inviteToken={null} />);
    const trap = container.querySelector<HTMLInputElement>('input[name="website"]')!;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("sends an invited signup as the invite's, not as a new business", async () => {
    render(<SignupForm inviteToken={TOKEN} />);
    setValue(field("name"), "Carol");
    setValue(field("email"), "carol@biz.com");
    setValue(field("password"), "correct horse");
    await submit();
    expect(customerSignUp.mock.calls[0][0]).toMatchObject({ inviteToken: TOKEN, accountType: "residential" });
  });

  it("shows the server's error as an alert", async () => {
    customerSignUp.mockResolvedValue({ error: "Too many emails were requested." });
    render(<SignupForm inviteToken={null} />);
    setValue(field("name"), "Alice");
    setValue(field("email"), "alice@example.com");
    setValue(field("password"), "correct horse");
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Too many emails");
  });

  it("replaces the form with 'Check your email', moves focus to it, and can resend", async () => {
    render(<SignupForm inviteToken={null} />);
    setValue(field("name"), "Alice");
    setValue(field("email"), "alice@example.com");
    setValue(field("password"), "correct horse");
    await submit();
    const heading = container.querySelector("h1")!;
    expect(heading.textContent).toBe("Check your email");
    expect(document.activeElement).toBe(heading);
    expect(container.textContent).toContain("alice@example.com");
    expect(container.querySelector("form")).toBeNull();
    // It never promises delivery: there is no custom email sender yet.
    expect(container.textContent).not.toMatch(/we(’|')ve sent/i);
    await click(button("Send the link again"));
    expect(resendConfirmation).toHaveBeenCalledWith("alice@example.com");
  });
});

describe("ForgotPasswordForm", () => {
  it("asks for an email, and says nothing about whether an account exists", async () => {
    render(<ForgotPasswordForm linkFailed={false} />);
    setValue(field("email"), "alice@example.com");
    await submit();
    expect(requestCustomerPasswordReset).toHaveBeenCalledWith("alice@example.com");
    expect(container.querySelector("h1")!.textContent).toBe("Check your email");
    expect(container.textContent).toContain("If alice@example.com has an account");
  });

  it("explains an expired reset link", () => {
    render(<ForgotPasswordForm linkFailed />);
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/expired or was already used/);
  });

  it("shows a refused request and keeps the form", async () => {
    requestCustomerPasswordReset.mockResolvedValue({ error: "Enter a valid email address." });
    render(<ForgotPasswordForm linkFailed={false} />);
    setValue(field("email"), "nope");
    await submit();
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("valid email");
  });
});

describe("ResetPasswordForm", () => {
  it("needs the two passwords to match, and says so on the field", async () => {
    render(<ResetPasswordForm />);
    setValue(field("new-password"), "a long enough password");
    setValue(field("confirm-password"), "something else entirely");
    await submit();
    expect(updateCustomerPassword).not.toHaveBeenCalled();
    expect(field("confirm-password").getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("The two passwords don't match.");
  });

  it("refuses a short password before asking the server", async () => {
    render(<ResetPasswordForm />);
    setValue(field("new-password"), "short");
    setValue(field("confirm-password"), "short");
    await submit();
    expect(updateCustomerPassword).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("at least 8");
  });

  it("saves a valid, matching password", async () => {
    render(<ResetPasswordForm />);
    setValue(field("new-password"), "a long enough password");
    setValue(field("confirm-password"), "a long enough password");
    await submit();
    expect(updateCustomerPassword).toHaveBeenCalledWith("a long enough password");
    expect(field("new-password").autocomplete).toBe("new-password");
  });
});

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../Login";
import Register from "../Register";
import Reset from "../Reset";

const mockNavigate = jest.fn();
const mockUseAuthState = jest.fn();
const mockLogInWithEmailAndPassword = jest.fn();
const mockRegisterWithEmailAndPassword = jest.fn(() => Promise.resolve());
const mockSendPasswordResetEmail = jest.fn(() => Promise.resolve());
const mockFetchContactsData = jest.fn(() => Promise.resolve([]));
const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock("react-firebase-hooks/auth", () => ({
  useAuthState: (...args) => mockUseAuthState(...args),
}));

jest.mock("../../firebase", () => ({
  auth: { signOut: jest.fn() },
  db: {},
  logInWithEmailAndPassword: (...args) => mockLogInWithEmailAndPassword(...args),
  registerWithEmailAndPassword: (...args) => mockRegisterWithEmailAndPassword(...args),
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
  fetchContactsData: (...args) => mockFetchContactsData(...args),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  getDocs: (...args) => mockGetDocs(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}));

describe("Auth related pages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthState.mockReturnValue([null, false]);
  });

  const renderWithRouter = (ui) =>
    render(<MemoryRouter initialEntries={["/"]}>{ui}</MemoryRouter>);

  it("renders the dashboard when Login already has an authenticated user", async () => {
    mockUseAuthState.mockReturnValue([{ uid: "demo" }, false]);
    mockOnSnapshot.mockImplementation((_, onNext) => {
      onNext({
        docs: [
          { data: () => ({ nombre: "Ana" }) },
          { data: () => ({ nombre: "Luis" }) },
        ],
      });
      return jest.fn();
    });

    renderWithRouter(<Login />);

    await waitFor(() => expect(screen.getByText(/Total de clientes: 2/)).toBeInTheDocument());
  });

  it("allows logging in by calling the firebase helper", async () => {
    const user = userEvent.setup();
    renderWithRouter(<Login />);

    await user.type(screen.getByPlaceholderText(/E-mail/i), "demo@mail.com");
    await user.type(screen.getByPlaceholderText(/Password/i), "Secret123!");
    await user.click(screen.getByRole("button", { name: /Ingresar/i }));

    expect(mockLogInWithEmailAndPassword).toHaveBeenCalledWith("demo@mail.com", "Secret123!");
  });

  it("sends the reset email with the provided address", async () => {
    const user = userEvent.setup();
    renderWithRouter(<Reset />);

    await user.type(screen.getByPlaceholderText(/E-mail Address/i), "reset@mail.com");
    await user.click(screen.getByRole("button", { name: /Send password reset email/i }));

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith("reset@mail.com");
  });

  it("creates users only when the password policy is satisfied", async () => {
    const user = userEvent.setup();
    mockUseAuthState.mockReturnValue([{ uid: "admin" }, false]);
    mockGetDocs.mockResolvedValue({
      forEach: (cb) => cb({ data: () => ({ role: "admin" }) }),
    });

    renderWithRouter(<Register />);

    await user.type(screen.getByPlaceholderText(/Nombre completo/i), "Administrador Demo");
    await user.type(screen.getByPlaceholderText(/Casilla de e-mail/i), "admin@mail.com");
    await user.selectOptions(screen.getByRole("combobox"), ["admin"]);
    await user.type(screen.getByPlaceholderText(/Contrase/i), "Clave123!");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Crear usuario/i })).not.toBeDisabled()
    );

    await user.click(screen.getByRole("button", { name: /Crear usuario/i }));

    expect(mockRegisterWithEmailAndPassword).toHaveBeenCalledWith(
      "Administrador Demo",
      "admin@mail.com",
      "Clave123!",
      "admin"
    );
  });
});

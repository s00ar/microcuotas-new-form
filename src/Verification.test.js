import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Verification from './pages/Verification';
import { MemoryRouter } from 'react-router-dom';
import { getDocs } from 'firebase/firestore';

jest.mock('./firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  getDocs: jest.fn(),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

describe('Verification Component', () => {
  beforeEach(() => {
    getDocs.mockResolvedValue({ forEach: () => {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('step 1: shows error when CUIL is empty', async () => {
    render(
      <MemoryRouter>
        <Verification />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Solicitar crédito/i }));

    expect(await screen.findByText(/CUIL no puede estar en blanco/i)).toBeInTheDocument();
  });

  test('step 2: shows error for invalid CUIL length', async () => {
    render(
      <MemoryRouter>
        <Verification />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/Ingresa tu cuil/i), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Solicitar crédito/i }));

    expect(await screen.findByText(/Ingresa un CUIL válido/i)).toBeInTheDocument();
  });

  test('step 3: shows error when CUIL already registered', async () => {
    const recentDate = new Date();
    getDocs.mockResolvedValue({
      forEach: (cb) => cb({ data: () => ({ timestamp: { toDate: () => recentDate } }) }),
    });

    render(
      <MemoryRouter>
        <Verification />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/Ingresa tu cuil/i), {
      target: { value: '20123456789' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Solicitar crédito/i }));

    expect(await screen.findByText(/El CUIL ya fue registrado en los últimos 30 días/i)).toBeInTheDocument();
  });
});


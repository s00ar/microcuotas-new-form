import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom'; // To mock routing in the app
import App from './App';

test('renders the banner component', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  const bannerElement = screen.getByRole('banner'); // Assuming your banner has a role "banner"
  expect(bannerElement).toBeInTheDocument();
});

test('renders verification form fields', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  const cuilInput = screen.getByPlaceholderText(/Ingresa tu cuil/i); // Testing CUIL input
  const cuotasRange = screen.getByLabelText(/Cantidad de Cuotas:/i); // Testing cuotas input
  const montoRange = screen.getByLabelText(/Monto Solicitado:/i); // Testing monto input

  expect(cuilInput).toBeInTheDocument();
  expect(cuotasRange).toBeInTheDocument();
  expect(montoRange).toBeInTheDocument();
});

test('renders the "Solicitar crédito" button', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  const buttonElement = screen.getByRole('button', { name: /Solicitar crédito/i });
  expect(buttonElement).toBeInTheDocument();
});

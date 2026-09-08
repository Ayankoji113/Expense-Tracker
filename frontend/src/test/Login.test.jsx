import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import client, { TOKEN_KEY } from '../api/client'
import { AuthProvider } from '../auth/AuthContext.jsx'
import Login from '../pages/Login.jsx'

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('stores the token returned by the API', async () => {
    vi.spyOn(client, 'post').mockResolvedValue({
      data: { token: 'jwt-123', email: 'a@test.com', expiresAt: '2030-01-01T00:00:00Z' },
    })

    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'a@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-123'))
    expect(client.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@test.com',
      password: 'password123',
    })
  })

  it('shows the server message and keeps the user signed out when login fails', async () => {
    vi.spyOn(client, 'post').mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } })

    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'a@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

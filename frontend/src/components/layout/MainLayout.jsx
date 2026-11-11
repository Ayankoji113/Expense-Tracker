import DarkModeIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeIcon from '@mui/icons-material/LightModeOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import { Avatar, Box, Button, ButtonBase, Drawer, IconButton, Stack, Typography } from '@mui/material'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import Wordmark from './Wordmark.jsx'

const DRAWER_WIDTH = 248

const NAV = [
  {
    heading: 'Ledger',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/transactions', label: 'Transactions' },
    ],
  },
  {
    heading: 'Plan',
    items: [
      { to: '/budgets', label: 'Budgets' },
      { to: '/analytics', label: 'Analytics' },
    ],
  },
  {
    heading: 'Set up',
    items: [
      { to: '/categories', label: 'Categories' },
      { to: '/import', label: 'Import CSV' },
    ],
  },
]

export default function MainLayout({ mode, onToggleMode }) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()

  const sidebar = (
    <Sidebar pathname={pathname} mode={mode} onToggleMode={onToggleMode} onNavigate={() => setDrawerOpen(false)} />
  )
  const paper = { width: DRAWER_WIDTH, bgcolor: 'background.default', borderRight: 1, borderColor: 'divider' }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="nav" aria-label="Main" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isDesktop ? (
          <Drawer variant="permanent" open slotProps={{ paper: { sx: paper } }}>
            {sidebar}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            ModalProps={{ keepMounted: true }}
            slotProps={{ paper: { sx: paper } }}
          >
            {sidebar}
          </Drawer>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!isDesktop && (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 'appBar',
              px: 1.5,
              height: 56,
              bgcolor: 'background.default',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <IconButton onClick={() => setDrawerOpen(true)} aria-label="Open navigation menu">
              <MenuIcon />
            </IconButton>
            <Wordmark />
          </Stack>
        )}

        <Box
          component="main"
          sx={{ px: { xs: 2, sm: 3, md: 5 }, py: { xs: 3, md: 5 }, flexGrow: 1, maxWidth: 1240, width: '100%', mx: 'auto' }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

function Sidebar({ pathname, mode, onToggleMode, onNavigate }) {
  const { user, email, logout } = useAuth()
  const displayName = user?.username ? `@${user.username}` : email

  return (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ px: 3, pt: 3.5, pb: 3 }}>
        <Wordmark />
      </Box>

      <Stack spacing={3} sx={{ px: 1.5, flexGrow: 1, overflowY: 'auto' }}>
        {NAV.map(({ heading, items }) => (
          <Box key={heading}>
            <Typography variant="overline" component="p" color="text.secondary" sx={{ px: 1.5, mb: 0.5 }}>
              {heading}
            </Typography>
            {items.map(({ to, label }) => (
              <NavLink key={to} to={to} active={pathname === to} onClick={onNavigate}>
                {label}
              </NavLink>
            ))}
          </Box>
        ))}
      </Stack>

      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <ButtonBase
          component={Link}
          to="/profile"
          onClick={onNavigate}
          aria-current={pathname === '/profile' ? 'page' : undefined}
          sx={{
            width: '100%',
            justifyContent: 'flex-start',
            gap: 1.25,
            p: 1,
            borderRadius: 1,
            textAlign: 'left',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Avatar
            src={user?.avatarUrl || undefined}
            variant="rounded"
            sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'primary.main', color: 'primary.contrastText' }}
          >
            {(user?.username || email || '?').slice(0, 1).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
              {displayName}
            </Typography>
            <Typography variant="caption" noWrap sx={{ display: 'block' }} title={email}>
              {email}
            </Typography>
          </Box>
        </ButtonBase>
        <Stack direction="row" sx={{ mt: 0.5 }}>
          <Button
            size="small"
            color="inherit"
            onClick={onToggleMode}
            startIcon={mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            sx={{ color: 'text.secondary', flexGrow: 1, justifyContent: 'flex-start' }}
          >
            {mode === 'light' ? 'Dark mode' : 'Light mode'}
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={logout}
            startIcon={<LogoutIcon />}
            sx={{ color: 'text.secondary' }}
          >
            Log out
          </Button>
        </Stack>
      </Box>
    </Stack>
  )
}

/** Plain text, with a bar in the margin marking the current page - the way a ledger tabs a section. */
function NavLink({ to, active, onClick, children }) {
  return (
    <ButtonBase
      component={Link}
      to={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      sx={{
        position: 'relative',
        width: '100%',
        justifyContent: 'flex-start',
        px: 1.5,
        py: 0.875,
        borderRadius: 1,
        fontSize: '0.9375rem',
        fontWeight: active ? 600 : 400,
        color: active ? 'text.primary' : 'text.secondary',
        '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
        '&::before': active
          ? {
              content: '""',
              position: 'absolute',
              left: -12,
              top: 7,
              bottom: 7,
              width: 3,
              borderRadius: '0 2px 2px 0',
              bgcolor: 'primary.main',
            }
          : undefined,
      }}
    >
      {children}
    </ButtonBase>
  )
}

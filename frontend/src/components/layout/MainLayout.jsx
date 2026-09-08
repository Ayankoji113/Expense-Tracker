import BarChartIcon from '@mui/icons-material/BarChart'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import DashboardIcon from '@mui/icons-material/SpaceDashboard'
import LightModeIcon from '@mui/icons-material/LightMode'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SavingsIcon from '@mui/icons-material/Savings'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import WalletIcon from '@mui/icons-material/AccountBalanceWallet'
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'

const DRAWER_WIDTH = 252

const NAV = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon },
  { to: '/transactions', label: 'Transactions', icon: ReceiptLongIcon },
  { to: '/budgets', label: 'Budgets', icon: SavingsIcon },
  { to: '/analytics', label: 'Analytics', icon: BarChartIcon },
  { to: '/categories', label: 'Categories', icon: LocalOfferIcon },
  { to: '/import', label: 'Import CSV', icon: UploadFileIcon },
]

const TITLES = Object.fromEntries(NAV.map((item) => [item.to, item.label]))

export default function MainLayout({ mode, onToggleMode }) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()

  const drawer = <SidebarContent pathname={pathname} onNavigate={() => setDrawerOpen(false)} />

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isDesktop ? (
          <Drawer
            variant="permanent"
            open
            slotProps={{
              paper: {
                sx: {
                  width: DRAWER_WIDTH,
                  borderRight: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                },
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            ModalProps={{ keepMounted: true }}
            slotProps={{ paper: { sx: { width: DRAWER_WIDTH } } }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="sticky"
          color="inherit"
          sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar sx={{ gap: 1 }}>
            {!isDesktop && (
              <IconButton edge="start" onClick={() => setDrawerOpen(true)} aria-label="Open navigation menu">
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
              {TITLES[pathname] || 'Expense Tracker'}
            </Typography>
            <Tooltip title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              <IconButton onClick={onToggleMode} aria-label="Toggle colour mode">
                {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{ p: { xs: 2, sm: 2.5, md: 3 }, flexGrow: 1, maxWidth: 1440, width: '100%', mx: 'auto' }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

function SidebarContent({ pathname, onNavigate }) {
  const { email, logout } = useAuth()

  return (
    <Stack sx={{ height: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 2.5 }}>
        <Box
          aria-hidden
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.contrastText',
            bgcolor: 'primary.main',
          }}
        >
          <WalletIcon fontSize="small" />
        </Box>
        <Typography variant="subtitle1" noWrap>
          Expense Tracker
        </Typography>
      </Stack>
      <Divider />

      <List sx={{ px: 1.5, py: 2, flexGrow: 1 }}>
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to
          return (
            <ListItemButton
              key={to}
              component={Link}
              to={to}
              onClick={onNavigate}
              selected={active}
              aria-current={active ? 'page' : undefined}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: active ? 'primary.main' : 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.16),
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={label} slotProps={{ primary: { fontWeight: active ? 600 : 500 } }} />
            </ListItemButton>
          )
        })}
      </List>

      <Divider />
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 2 }}>
        <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main', fontSize: 14 }}>
          {(email || '?').slice(0, 1).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" noWrap title={email}>
            {email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Signed in
          </Typography>
        </Box>
        <Tooltip title="Log out">
          <IconButton onClick={logout} aria-label="Log out" size="small">
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  )
}

'use client';

import React, { useState, useContext } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
} from '@mui/material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MenuIcon from '@mui/icons-material/Menu';
import AppsIcon from '@mui/icons-material/Apps';
import SettingsIcon from '@mui/icons-material/Settings';
import CodeIcon from '@mui/icons-material/Code';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { ThemeModeContext } from '@/app/Providers';

const drawerWidth = 260;

const navigationItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <AppsIcon />,
    matchesPath: (pathname: string) => pathname === '/',
  },
  {
    label: 'Catalog',
    href: '/catalog',
    icon: <GridViewRoundedIcon />,
    matchesPath: (pathname: string) => pathname.startsWith('/catalog'),
  },
  {
    label: 'Applications',
    href: '/applications',
    icon: <CodeIcon />,
    matchesPath: (pathname: string) => pathname.startsWith('/applications'),
  },
  {
    label: 'Resources',
    href: '/resources',
    icon: <StorageRoundedIcon />,
    matchesPath: (pathname: string) => pathname.startsWith('/resources'),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <SettingsIcon />,
    matchesPath: (pathname: string) => pathname.startsWith('/settings'),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const colorMode = useContext(ThemeModeContext);
  const pathname = usePathname();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <div>
      <Toolbar sx={{ px: 2 }}>
        <AppsIcon sx={{ mr: 2, color: 'primary.main' }} />
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ color: 'text.primary', fontWeight: 600 }}
        >
          IDP Console
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ pt: 2 }}>
        {navigationItems.map((item) => {
          const isSelected = item.matchesPath
            ? item.matchesPath(pathname)
            : false;

          return (
            <ListItem key={item.label} disablePadding>
              <ListItemButton
                component={item.href ? Link : 'button'}
                href={item.href}
                selected={isSelected}
                aria-current={isSelected ? 'page' : undefined}
                disabled={!item.href}
                sx={{
                  borderRadius: '0 24px 24px 0',
                  mr: 2,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(138, 180, 248, 0.12)',
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ flexGrow: 1, fontSize: 18 }}
          >
            Platform Operations
          </Typography>
          <IconButton onClick={colorMode.toggleColorMode} color="inherit">
            {colorMode.mode === 'dark' ? (
              <Brightness7Icon />
            ) : (
              <Brightness4Icon />
            )}
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

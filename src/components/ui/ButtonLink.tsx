'use client';

import { Button, type ButtonProps } from '@mui/material';
import Link from 'next/link';
import type { ReactNode } from 'react';

type ButtonLinkProps = Omit<ButtonProps<typeof Link>, 'component' | 'href'> & {
  href: string;
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  children: ReactNode;
};

export default function ButtonLink({
  href,
  prefetch,
  replace,
  scroll,
  children,
  ...buttonProps
}: ButtonLinkProps) {
  return (
    <Button
      component={Link}
      href={href}
      prefetch={prefetch}
      replace={replace}
      scroll={scroll}
      {...buttonProps}
    >
      {children}
    </Button>
  );
}

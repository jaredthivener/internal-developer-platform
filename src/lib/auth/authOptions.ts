import { AuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';

export const authOptions: AuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
      tenantId: process.env.AZURE_AD_TENANT_ID || '',
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        // Here we could extract RBAC roles from Azure AD tokens and assign to session
        // e.g., token.roles = profile.roles
      }
      return token;
    },
    async session({ session, token }) {
      // Pass the roles and user context to the active session
      if (session.user) {
        //@ts-expect-error - stub for session typing in MVP
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/api/auth/signin',
  },
};

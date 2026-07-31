import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { SettingsProvider } from "@/providers/settings-provider";
import { GoogleAuthProvider } from "@/providers/google-auth-provider";
import { DataProvider } from "@/providers/data-provider";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} | Construction Account Keeper`,
  description: APP_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased selection:bg-amber-500 selection:text-black" suppressHydrationWarning>
        <ThemeProvider>
          <SettingsProvider>
            <GoogleAuthProvider>
              <DataProvider>{children}</DataProvider>
            </GoogleAuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

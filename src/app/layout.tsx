import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

import { GoogleAnalytics, GoogleTagManager } from "@next/third-parties/google";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import FooterSection from "@/components/footer";
import { MathJaxContext } from "better-react-mathjax";

import { Toaster } from "sonner";

import { AssessmentProvider } from "@/contexts/assessment-context";
import { ReduxProvider } from "@/lib/redux/Provider";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";
import { SessionInitializer } from "@/components/auth/SessionInitializer";
import { MigrationChecker } from "@/components/auth/MigrationChecker";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeApplier } from "@/components/ThemeApplier";
import { FloatingPreferencesButton } from "@/components/preferences-popover";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SAT Prep - Free SAT Practice Questions & Test Prep",
    template: "%s | SAT Prep",
  },
  description:
    "Master the SAT with our comprehensive question bank featuring real College Board practice questions. Track your progress, identify weak areas, and boost your SAT scores with targeted practice sessions.",
  keywords: [
    "SAT practice",
    "SAT test prep",
    "College Board questions",
    "SAT math",
    "SAT reading",
    "SAT writing",
    "standardized test prep",
    "college admissions",
    "practice questions",
    "SAT score improvement",
  ],
  authors: [{ name: "SAT Prep Team" }],
  creator: "SAT Prep",
  publisher: "SAT Prep",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://study-platform.vercel.app",
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "SAT Prep - Free SAT Practice Questions & Test Prep",
    description:
      "Master the SAT with our comprehensive question bank featuring real College Board practice questions. Track your progress and boost your SAT scores.",
    siteName: "SAT Prep",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SAT Prep - SAT Test Preparation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SAT Prep - Free SAT Practice Questions & Test Prep",
    description:
      "Master the SAT with our comprehensive question bank featuring real College Board practice questions. Track your progress and boost your SAT scores.",
    images: ["/og-image.png"],
    creator: "@study-platform",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    yahoo: process.env.YAHOO_VERIFICATION,
  },
  category: "education",
  classification: "Education, Test Preparation, SAT",
  referrer: "origin-when-cross-origin",
};

const config = {
  /* in theory, the MathML input processor should be activated if we add
  an "mml" block to the config OR if "input/mml" (NOT "input/mathml" as stated 
  in the docs) is in the load array. However, this is not necessary as MathML is 
  ALWAYS enabled in MathJax */
  loader: { load: ["input/mml", "output/chtml"] },
  mml: {},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* User declared canonical URL */}
        <link rel="canonical" href="https://www.study-platform.local" />

        {/* Additional SEO meta tags */}
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <meta
          name="googlebot"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />

        {/* Structured data for organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "EducationalOrganization",
              "@id": "https://www.study-platform.local/#organization",
              name: "SAT Prep",
              alternateName: "My SAT Prep",
              url: "https://www.study-platform.local",
              logo: {
                "@type": "ImageObject",
                url: "https://www.study-platform.local/icon-512x512.png",
                width: 512,
                height: 512,
              },
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                email: "support@study-platform.local",
                availableLanguage: ["English"],
              },
              sameAs: [
                "https://www.facebook.com/study-platform",
                "https://www.twitter.com/study-platform",
                "https://www.instagram.com/study-platform",
                "https://www.youtube.com/study-platform",
              ],
              foundingDate: "2024",
              description:
                "Leading educational technology platform providing free SAT practice questions and comprehensive test preparation resources",
              knowsAbout: [
                "SAT Test Preparation",
                "College Board Questions",
                "Digital SAT",
                "Standardized Test Prep",
                "Educational Assessment",
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* <Banner
          message="Some features may be unavailable due to the ongoing global outage."
          height="2rem"
          variant="rainbow"
        /> */}

        <ErrorBoundary>
          <AssessmentProvider>
            <MathJaxContext version={3} config={config}>
              <ReduxProvider>
                <ThemeApplier />
                <SessionInitializer />
                <MigrationChecker />
                <AuthSessionProvider>{children}</AuthSessionProvider>
                <FloatingPreferencesButton />
              </ReduxProvider>
            </MathJaxContext>
          </AssessmentProvider>
        </ErrorBoundary>

        <GoogleAnalytics gaId={process.env.GA_KEY || ""} />
        <GoogleTagManager gtmId={process.env.GT_KEY || ""} />
        <SpeedInsights />
        <Analytics />
        <Toaster position="bottom-right" expand={true} closeButton={true} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "tvx8ozuprp");
`,
          }}
        ></script>
      </body>
    </html>
  );
}

import ResourceSection from "@/components/resources";
import React from "react";
import { SiteHeader } from "../navbar";
import type { Metadata } from "next";
import FooterSection from "@/components/footer";
import ContributorsSection from "@/components/contributors-section";

export const metadata: Metadata = {
  title: "Contributors - SAT Prep",
  description:
    "Meet the contributors behind SAT Prep. Explore the open source community members who build features, suggest improvements, and report bugs to make SAT prep better for everyone.",
  keywords: [
    "SAT Prep contributors",
    "open source contributors",
    "SAT prep community",
    "SAT Prep team",
    "feature contributors",
    "bug reporters",
    "community feedback",
    "community contributors",
    "SAT education platform",
    "SAT Prep open source",
  ],
  openGraph: {
    title: "Contributors - SAT Prep",
    description:
      "Meet the contributors and community members helping build SAT Prep through feature ideas, bug reports, and open source collaboration.",
    type: "website",
    url: "/contributors",
    images: [
      {
        url: "/og-contributors.png",
        width: 1200,
        height: 630,
        alt: "SAT Prep Contributors",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contributors - SAT Prep",
    description:
      "Meet the contributors and community members helping improve SAT Prep through collaboration and feedback.",
    images: ["/og-contributors.png"],
  },
  alternates: {
    canonical: "/contributors",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Page() {
  return (
    <React.Fragment>
      <SiteHeader />;
      <ContributorsSection />
      <FooterSection />
    </React.Fragment>
  );
}

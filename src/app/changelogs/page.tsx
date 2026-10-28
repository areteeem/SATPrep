import { Component as ChangelogPage } from "@/components/ui/interactive-changelog-with-dialog";
import React from "react";
import { SiteHeader } from "../navbar";
import type { Metadata } from "next";
import FooterSection from "@/components/footer";
import { members, type communityUser } from "@/lib/contributors";

async function fetchcommunityUser(username: string): Promise<communityUser | null> {
  try {
    const response = await fetch(`/${username}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "SAT Prep",
      },
      cache: "force-cache",
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "SAT Prep Changelog - Latest Updates, Fixes & Release Notes",
  description:
    "Read the latest SAT Prep changelog for product updates, new features, bug fixes, and release notes across SAT practice, question bank, vocab, and study tools.",
  keywords: [
    "SAT Prep changelog",
    "release notes",
    "product updates",
    "feature updates",
    "bug fixes",
    "platform news",
    "SAT prep updates",
    "question bank improvements",
    "study tool updates",
    "site changelog",
  ],
  openGraph: {
    title: "SAT Prep Changelog - Latest Updates, Fixes & Release Notes",
    description:
      "See the latest SAT Prep product updates, feature releases, and bug fixes for SAT practice, vocab, and study tools.",
    type: "website",
    url: "/changelogs",
    images: [
      {
        url: "/seo/dashboard-layout.png",
        width: 1200,
        height: 630,
        alt: "SAT Prep changelog and product updates",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SAT Prep Changelog - Latest Updates, Fixes & Release Notes",
    description:
      "Read the latest SAT Prep updates, feature releases, and bug fixes.",
    images: ["/seo/dashboard-layout.png"],
  },
  alternates: {
    canonical: "/changelogs",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function Page() {
  const contributors = await Promise.all(
    members.map(async (member) => {
      const githubUser = await fetchcommunityUser(member.username);
      return {
        username: member.username,
        name: githubUser?.name ?? githubUser?.login ?? member.username,
        designation: member.role,
        image:
          githubUser?.avatar_url ??
          "/icon-192x192.png",
      };
    }),
  );

  const githubUsersMap = contributors.reduce(
    (acc, contributor) => {
      acc[contributor.username] = contributor;
      return acc;
    },
    {} as Record<string, (typeof contributors)[0]>,
  );

  return (
    <React.Fragment>
      <SiteHeader disableBlur disableScroll />
      <ChangelogPage githubUsersMap={githubUsersMap} />
      <FooterSection />
    </React.Fragment>
  );
}

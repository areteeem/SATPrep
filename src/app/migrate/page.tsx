import type { Metadata } from "next";
import React from "react";

import { MigrateHeroSection } from "@/components/migrate/migrate-hero";

export const metadata: Metadata = {
	title: "Migrate Your SAT Prep Data - SAT Prep",
	description:
		"Continue your SAT prep on SAT Prep with a simple migration experience for saved progress and practice history.",
	alternates: {
		canonical: "https://www.study-platform.local/migrate",
	},
};

export default function MigratePageComponent() {
	return <MigrateHeroSection />;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EventForm } from "@/features/calendar/components/event-form";
import { eventOptions, nextHourSlot } from "@/features/calendar/options";
import { utcToLocalInput } from "@/features/calendar/rules";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nouvel événement" };

type SP = { projet?: string; client?: string; opportunite?: string };

async function Form({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const [sp, options] = await Promise.all([searchParams, eventOptions()]);
  const slot = nextHourSlot();
  return (
    <EventForm
      {...options}
      initial={{
        title: "",
        description: "",
        location: "",
        start: utcToLocalInput(slot.start),
        end: utcToLocalInput(slot.end),
        allDay: false,
        visibility: "OCCUPE",
        attendeeIds: [],
        projectId: sp.projet ?? "",
        clientId: sp.client ?? "",
        opportunityId: sp.opportunite ?? "",
      }}
    />
  );
}

export default function NewEventPage({ searchParams }: PageProps<"/calendrier/nouveau">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/calendrier">Calendrier</BackLink>
      <PageHeader
        title="Nouvel événement"
        description="Les participants sont prévenus dans l'application et par e-mail."
      />
      <Card className="max-w-3xl">
        <Suspense fallback={<PageLoading />}>
          <Form searchParams={searchParams as Promise<SP>} />
        </Suspense>
      </Card>
    </div>
  );
}

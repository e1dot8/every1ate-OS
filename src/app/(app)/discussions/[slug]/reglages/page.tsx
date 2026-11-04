import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Archive, ArchiveRestore, CalendarDays, FolderKanban, Lock, Video } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, EmptyLine, NotionPage, Properties, Property, Section } from "@/components/notion/blocks";
import { formatDay } from "@/lib/dates";
import { archiveChannelAction, createJitsiAction, removeMemberAction } from "@/app/(app)/discussions/actions";
import { listAssociates } from "@/features/projects/service";
import { accessChannel } from "@/features/discussions/channels";
import { AddMemberForm, ChannelSettingsForm } from "@/features/discussions/components/forms";
import { DiscussionsFrame, discussionsViewer } from "@/features/discussions/components/frame";
import { PresenceDot } from "@/features/discussions/components/presence-dot";
import { channelMembers, directPartner } from "@/features/discussions/queries";
import { canArchiveChannel, channelIcon, channelTitle, isDefaultChannel } from "@/features/discussions/rules";

export const metadata: Metadata = { title: "Réglages du salon" };

const kindLabels = {
  PUBLIC: "Salon public (tous les associés)",
  PRIVE: "Salon privé (membres choisis)",
  DIRECT: "Message direct",
  PERSO: "Notes perso (toi seul)",
} as const;

async function SettingsView({ params }: { params: Promise<{ slug: string }> }) {
  const user = await discussionsViewer();
  const { slug } = await params;
  const access = await accessChannel({ slug }, user.id);
  if (!access) notFound();
  const { channel } = access;
  const now = new Date();
  const [members, partner] = await Promise.all([
    channelMembers(channel.id),
    channel.kind === "DIRECT" ? directPartner(channel.id, user.id, now) : null,
  ]);
  const title = channelTitle({ ...channel, projectName: channel.project?.name, partnerName: partner?.name });
  const writable = !channel.archivedAt;
  const renamable =
    (channel.kind === "PUBLIC" || channel.kind === "PRIVE") &&
    !channel.projectId &&
    !isDefaultChannel(channel.slug);
  const candidates =
    channel.kind === "PRIVE" && writable
      ? (await listAssociates())
          .filter((a) => !members.members.some((m) => m.id === a.id))
          .map((a) => ({ value: a.id, label: a.name }))
      : [];

  return (
    <NotionPage
      icon={channelIcon(channel)}
      crumbs={[
        { label: "Discussions", href: "/discussions" },
        { label: title, href: `/discussions/${channel.slug}` },
      ]}
      title={`Réglages · ${title}`}
    >
      <BackLink href={`/discussions/${channel.slug}`}>Retour au salon</BackLink>
      <Properties>
        <Property icon={Lock} label="Type">
          {kindLabels[channel.kind]}
        </Property>
        <Property icon={CalendarDays} label="Créé le">
          {formatDay(channel.createdAt)}
        </Property>
        {channel.project ? (
          <Property icon={FolderKanban} label="Projet">
            {channel.project.name}
          </Property>
        ) : null}
        <Property icon={Video} label="Visio">
          {channel.meetUrl ? (
            <a
              href={channel.meetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all underline"
            >
              {channel.meetUrl}
            </a>
          ) : (
            <span className="text-muted-foreground">Aucun lien</span>
          )}
        </Property>
      </Properties>

      {channel.archivedAt ? (
        <Callout icon="🗄️" tone="warning">
          Salon archivé : restaure-le pour le modifier ou y écrire.
        </Callout>
      ) : (
        <>
          <Section title="Sujet et visio">
            <ChannelSettingsForm
              channel={{ id: channel.id, name: channel.name, topic: channel.topic, meetUrl: channel.meetUrl }}
              renamable={renamable}
            />
            <form action={createJitsiAction} className="flex flex-wrap items-center gap-2 pt-2">
              <input type="hidden" name="channelId" value={channel.id} />
              <SubmitButton variant="outline" pendingLabel="Création…">
                Créer une salle Jitsi
              </SubmitButton>
              <span className="text-sm text-muted-foreground">
                Gratuit, sans compte : le lien remplace l&apos;actuel.
              </span>
            </form>
          </Section>
        </>
      )}

      {channel.kind !== "PERSO" ? (
        <Section title="Membres" count={members.count}>
          {channel.kind === "PUBLIC" ? (
            <p className="text-sm text-muted-foreground">
              Salon public : tous les associés y ont accès ; on le rejoint en l&apos;ouvrant.
            </p>
          ) : null}
          {members.members.length ? (
            <ul className="flex flex-col">
              {members.members.map((m) => (
                <li
                  key={m.id}
                  className="flex min-h-tap items-center gap-2 rounded-md px-1 hover:bg-muted/60"
                >
                  <PresenceDot state={m.presenceShared ? m.presenceState : "DISPO"} />
                  <span className="min-w-0 flex-1 truncate">
                    {m.name}
                    {m.id === user.id ? " (toi)" : ""}
                  </span>
                  {channel.kind === "PRIVE" && writable && members.count > 1 ? (
                    <form action={removeMemberAction}>
                      <input type="hidden" name="channelId" value={channel.id} />
                      <input type="hidden" name="userId" value={m.id} />
                      <SubmitButton variant="ghost" pendingLabel="…">
                        {m.id === user.id ? "Quitter" : `Retirer ${m.name}`}
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine>Personne n&apos;a encore rejoint ce salon.</EmptyLine>
          )}
          {members.count > members.members.length ? (
            <p className="text-xs text-muted-foreground">
              {members.members.length} premiers sur {members.count}.
            </p>
          ) : null}
          {channel.kind === "PRIVE" && writable ? (
            <AddMemberForm channelId={channel.id} candidates={candidates} />
          ) : null}
        </Section>
      ) : null}

      {canArchiveChannel(channel) ? (
        <Section title="Archivage">
          <p className="text-sm text-muted-foreground">
            {channel.archivedAt
              ? "Restaurer rend le salon de nouveau modifiable."
              : "Un salon archivé reste lisible (historique complet) mais n'accepte plus de message."}
          </p>
          <form action={archiveChannelAction}>
            <input type="hidden" name="channelId" value={channel.id} />
            <input type="hidden" name="archived" value={channel.archivedAt ? "false" : "true"} />
            <SubmitButton variant="outline" pendingLabel="…">
              {channel.archivedAt ? (
                <>
                  <ArchiveRestore aria-hidden="true" /> Restaurer le salon
                </>
              ) : (
                <>
                  <Archive aria-hidden="true" /> Archiver le salon
                </>
              )}
            </SubmitButton>
          </form>
        </Section>
      ) : null}
    </NotionPage>
  );
}

export default function SettingsPage({ params }: PageProps<"/discussions/[slug]/reglages">) {
  return (
    <DiscussionsFrame>
      <Suspense fallback={<PageLoading />}>
        <SettingsView params={params} />
      </Suspense>
    </DiscussionsFrame>
  );
}

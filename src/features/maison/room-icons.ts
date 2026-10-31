import { BookOpen, ChefHat, ConciergeBell, DoorOpen, Lock, Users, type LucideIcon } from "lucide-react";
import type { RoomKey } from "@/features/maison/rooms";

/** Pictogramme de chaque pièce, partagé par le plan, la navigation et le design system. */
export const ROOM_ICONS: Record<RoomKey, LucideIcon> = {
  appartement: DoorOpen,
  bureau: Users,
  recettes: BookOpen,
  salle: ConciergeBell,
  cuisine: ChefHat,
  client: Lock,
};

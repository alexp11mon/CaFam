"use client";

import { AvailabilitySetting } from "./availability-setting";

/**
 * Consent to show my busy times in the grid of people who share a calendar
 * with me; off by default and apart from the assistant's (spec 020 RF-1 to
 * RF-3, plan D1).
 */
export function BusySetting(props: {
  current: boolean;
  save: (share: boolean) => Promise<{ error?: string }>;
}) {
  return (
    <AvailabilitySetting
      {...props}
      label="Mostrar a los demás cuándo estoy ocupado en su calendario"
      description="En su semana y su día verán bloques «Ocupado» con tu nombre, sin título, lugar, descripción ni calendario. Lo ven solo las personas con las que compartes algún calendario y que elijan verlo."
    />
  );
}

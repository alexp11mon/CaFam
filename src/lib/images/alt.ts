/** "Cumpleaños de Ana, imagen 2 de 5" (RF-14); `index` starts at 0. */
export function imageAlt(title: string, index: number, total: number): string {
  return `${title}, imagen ${index + 1} de ${total}`;
}

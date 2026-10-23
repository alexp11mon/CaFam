/**
 * The event being created from an empty slot, before it is saved: it draws the
 * provisional block and fills the quick window (spec 008 RF-37, RF-40).
 */
export interface Draft {
  /** YYYY-MM-DD in the user's zone. */
  day: string;
  allDay: boolean;
  /** Minutes from midnight; ignored when all-day. */
  startMinute: number;
  endMinute: number;
}

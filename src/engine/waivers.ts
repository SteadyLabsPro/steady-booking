/**
 * Waiver policy helpers. Waivers are one-time per customer and versioned:
 * a customer only needs to (re)sign when they have not signed the currently
 * active waiver version (from tenant config).
 */

/**
 * Whether a customer must sign the waiver before booking.
 *
 * @param signedVersions Every waiver version this customer has already signed.
 * @param activeVersion  The active waiver version from tenant config.
 * @returns true if the active version is not among the signed versions.
 */
export function needsWaiver(
  signedVersions: readonly number[],
  activeVersion: number,
): boolean {
  return !signedVersions.includes(activeVersion);
}

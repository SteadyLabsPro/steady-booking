/**
 * Pricing helpers. Prices are stored as integer minor units on each session;
 * the currency comes from tenant config. Keeping money in minor units avoids
 * floating-point rounding bugs.
 */

/**
 * Format a minor-unit amount as a currency string.
 *
 * @param minorUnits Amount in minor units (e.g. 2500 = £25.00 for GBP).
 * @param currency   ISO 4217 code from tenant config (e.g. "GBP").
 * @param locale     BCP 47 locale for formatting; defaults to en-GB.
 *
 * Assumes a 2-decimal currency, which covers GBP/USD/EUR and the MVP's needs.
 */
export function formatPrice(
  minorUnits: number,
  currency: string,
  locale = "en-GB",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(minorUnits / 100);
}

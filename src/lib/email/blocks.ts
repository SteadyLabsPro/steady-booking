import { tenant } from "@/config/tenant.config";

/**
 * Shared email building blocks, so the same message can't drift between the
 * booking and pass confirmations.
 */

/**
 * The access-code callout — a navy header bar over a bordered cream panel.
 * Inline-styled tables for broad email-client support.
 * `variant: "pass"` uses the wording for someone who's just bought a pass.
 */
export function accessNoticeHtml(variant: "booking" | "pass" = "booking"): string {
  const { heading, body, passBody } = tenant.accessNotice;
  const text = variant === "pass" ? (passBody ?? body) : body;

  return `
        <table style="width:100%;border-collapse:collapse;margin:24px 0 0;">
          <tr>
            <td style="background:#173a4e;border-radius:10px 10px 0 0;padding:12px 16px;">
              <span style="color:#c2a06a;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${heading}</span>
            </td>
          </tr>
          <tr>
            <td style="background:#f5eee6;border:1px solid #c2a06a;border-top:0;border-radius:0 0 10px 10px;padding:16px;">
              <p style="margin:0;color:#211f1c;font-size:14px;line-height:1.5;">${text}</p>
            </td>
          </tr>
        </table>`;
}

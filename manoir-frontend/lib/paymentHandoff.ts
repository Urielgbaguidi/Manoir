/**
 * Relais entre le panneau de paiement et la page de retour FeexPay.
 *
 * Après un paiement, le checkout FeexPay redirige vers `callback_url` (page
 * de retour) : les requêtes lancées juste avant par le panneau peuvent être
 * interrompues par ce changement de page. Le panneau dépose donc ici, pour la
 * durée de l'onglet, les indices utiles à la page de retour :
 * - l'opérateur choisi (affichage seulement) ;
 * - en SANDBOX, la confirmation simulée renvoyée par le SDK.
 *
 * Aucune donnée sensible (ni jeton, ni clé) : le serveur revérifie tout.
 */
export type SandboxConfirmation = {
  description: string;
  callback_info: { payment_id: number };
  reseau: string | null;
};

export type PaymentHandoff = {
  network: string | null;
  sandbox: SandboxConfirmation | null;
};

const keyFor = (paymentId: number) => `manoir:payment-handoff:${paymentId}`;

/** Confirmation affichée au client, par le panneau comme par la page de retour. */
export const PAYMENT_SUCCESS_MESSAGE = "Paiement confirmé. Votre Bon de Séjour est disponible.";

const announcedPayments = new Set<number>();

/**
 * Vrai la première fois qu'un paiement réussi est annoncé dans cette page :
 * le panneau et la page de retour ne notifient donc qu'une fois le même
 * paiement. (Après un rechargement complet, l'annonce précédente a disparu
 * de l'écran : la notifier à nouveau est alors voulu.)
 */
export function claimPaymentAnnouncement(paymentId: number): boolean {
  if (announcedPayments.has(paymentId)) return false;
  announcedPayments.add(paymentId);
  return true;
}

export function savePaymentHandoff(paymentId: number, handoff: PaymentHandoff): void {
  try {
    window.sessionStorage.setItem(keyFor(paymentId), JSON.stringify(handoff));
  } catch {
    /* stockage indisponible : la page de retour vérifiera sans indice */
  }
}

/** Lit puis efface le relais d'un paiement. */
export function takePaymentHandoff(paymentId: number): PaymentHandoff | null {
  try {
    const raw = window.sessionStorage.getItem(keyFor(paymentId));
    window.sessionStorage.removeItem(keyFor(paymentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PaymentHandoff>;
    return {
      network: typeof parsed.network === "string" ? parsed.network : null,
      sandbox:
        parsed.sandbox &&
        typeof parsed.sandbox.description === "string" &&
        typeof parsed.sandbox.callback_info?.payment_id === "number"
          ? parsed.sandbox
          : null
    };
  } catch {
    return null;
  }
}

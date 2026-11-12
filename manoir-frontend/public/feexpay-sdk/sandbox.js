/*
 * FeexPay JavaScript SDK 1.1.0 - copie locale pour le mode SANDBOX.
 *
 * Correctif Manoir : le SDK officiel code en dur l'URL de production
 * https://api-v2.feexpay.me, qui ne connait pas les boutiques du sandbox.
 * La seule difference avec le fichier original est le remplacement de cette
 * URL par https://sandbox-api.feexpay.me.
 *
 * Original : https://api-v2.feexpay.me/feexpay-javascript-sdk/index.js
 * A regenerer si FeexPay publie une version corrigee.
 */
/**
 * FeexPay JavaScript SDK
 *
 * A JavaScript SDK for integrating FeexPay payment processing
 * into websites using HTML/CSS/JS.
 *
 * Version: 1.1.0
 */

(function() {

  // Store SDK configuration
  const FeexPayConfig = {
    //  baseUrl: 'https://testnet-api.feexpay.me',
    baseUrl :'https://sandbox-api.feexpay.me',
    // baseUrl :'http://localhost:5009',

    containerId: null,
    options: {},
    modalElement: null,
    resultModalElement:null,
    styles: null,
    merchantInfo: null,
    shopValid: false,
    callbackCalled: false // Flag to track if callback has been called
  };

  // Define network API identifiers
  const networkApiIds = {
    'Benin': {
      'MTN': 'mtn',
      'MOOV': 'moov',
      'CELTIIS': 'celtiis bj',
      // 'CORIS': 'coris'
    },
    'Togo': {
      'YAS': 'togocom tg',
      'MOOV': 'moov tg'
    },
    'Côte d\'Ivoire': {
      'MTN': 'mtn ci',
      'ORANGE': 'orange ci',
      'MOOV': 'moov ci',
      // 'WAVE': 'wave ci'
    },
    'Burkina Faso': {
      'ORANGE': 'orange bf',
      'MOOV': 'moov bf'
    },

    'Senegal': {
      'ORANGE': 'orange sn',
      'FREE MONEY': 'free sn',
      'WAVE': 'wave sn'
    },
    'Congo-Brazzaville': {
      'MTN': 'mtn cg'
    },
    'Ghana': {
      'MTN': 'mtn gh',
      'AIRTEL': 'airtel gh',
      'VODAFONE': 'vodafone gh'
    },
  };

  // Define networks that require OTP
  const networksRequiringOtp = ['CORIS'];

  // Define wallet providers by country
  const walletProviders = {
    // 'Benin': ['CORIS'], // CORIS n'est pas un réseau accepté par requesttopay/integration
    'Benin': ['BMO'],
    'Côte d\'Ivoire': ['WAVE', 'DJAMO'],
    'Senegal': ['WAVE'],
    'Burkina Faso': ['WAVE']
  };

  // <feexpay-shared> — bloc commun à index.js et modal.js, synchronisé par
  // scripts/sdk-sync.mjs : ne modifier que dans index.js puis lancer `npm run sdk:sync`.
  // Échappe une valeur avant insertion via innerHTML (messages serveur, infos shop)
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Codes réseau des wallets, tels qu'envoyés au débit
  const walletApiIds = {
    'Benin': { 'CORIS': 'CORIS', 'BMO': 'BMO' },
    'Côte d\'Ivoire': { 'WAVE': 'WAVE CI', 'DJAMO': 'DJAMO CI' },
    'Senegal': { 'WAVE': 'WAVE SN' },
    'Burkina Faso': { 'WAVE': 'WAVE BF' }
  };

  // Code réseau à envoyer à /api/transactions/details : le même que celui du débit,
  // sinon le serveur ne peut pas distinguer MOOV Bénin de MOOV Togo, etc.
  const getFeeReseau = (country, network) =>
    (networkApiIds[country]?.[network] || walletApiIds[country]?.[network] || network || '').toUpperCase();

  // Frais calculés par le serveur (source de vérité) pour un réseau donné.
  // taxe est un taux décimal (0.017 → 1.7 %).
  const fetchTransactionFees = (reseau) =>
    fetch(`${FeexPayConfig.baseUrl}/api/transactions/details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: FeexPayConfig.options.amount,
        reseau: reseau,
        shop: FeexPayConfig.options.id
      })
    })
      .then(response => {
        if (!response.ok) throw new Error(`FeexPay: transactions/details HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        const shouldApplyFees = data.iffees === true;
        const feeAmount = shouldApplyFees ? Number(data.fees) || 0 : 0;
        const totalAmount = shouldApplyFees
          ? (Number(data.real_amount) || FeexPayConfig.options.amount + feeAmount)
          : FeexPayConfig.options.amount;
        const feeRate = Number(data.taxe);
        const feePercentage = Number.isFinite(feeRate)
          ? (feeRate * 100).toFixed(1).replace('.0', '')
          : null;
        return { shouldApplyFees, feeAmount, totalAmount, feePercentage };
      });

  const formatFeeNote = ({ shouldApplyFees, feePercentage }) => shouldApplyFees
    ? `*Des frais de transaction${feePercentage ? ` de ${feePercentage}%` : ''} sont applicables au montant.`
    : '*Aucun frais de transaction applicable pour cette transaction.';

  // Traduit une réponse d'erreur de l'API FeexPay en message lisible pour le payeur.
  // Formats renvoyés par l'API :
  //  - erreur métier     : { statusCode, message, code? }
  //  - validation        : { statusCode: 400, message: 'Validation failed', errors: [{ property, constraints }] }
  //  - erreur opérateur  : { message: 'Wave API Error', code: 'WAVE_API_ERROR', details: <réponse opérateur> }
  //                        ou { error: 'Wave Sénégal API Error', message: <réponse opérateur> }
  //  - erreur 5xx        : { statusCode, message: 'Internal Server Error' } (détail masqué par l'API)
  // Limites de montant B-MO (cf. RequestToPayBmoDto côté API)
  const BMO_MIN_AMOUNT = 200;
  const BMO_MAX_AMOUNT = 2000000;

  // Raison d'échec renvoyée par B-MO (champ `reason`) → message lisible pour le payeur
  const BMO_REASONS = {
    'INSUFFICIENT BALANCE': 'Solde B-MO insuffisant pour effectuer ce paiement.',
  };
  const bmoFailureMessage = (reason) => {
    if (!reason) return 'Le paiement a été refusé par B-MO.';
    const key = String(reason).trim().toUpperCase().replace(/[_\s]+/g, ' ');
    return BMO_REASONS[key] || `Le paiement a été refusé par B-MO : ${reason}`;
  };

  const getApiErrorMessage = (() => {
    const OPERATORS = {
      WAVE: 'Wave', MTN: 'MTN', MOOV_BJ: 'Moov', MOOV_CI: 'Moov', MOOV_TG: 'Moov',
      CELTIIS_BJ: 'Celtiis', TOGOCOM: 'Togocom', BMO: 'B-MO',
    };
    const FIELD_MESSAGES = {
      phoneNumber: 'Numéro de téléphone invalide.',
      amount: 'Montant invalide : il doit être compris entre 10 et 2 000 000.',
      email: 'Adresse email invalide.',
      reseau: "Ce réseau n'est pas pris en charge.",
      shop: 'Identifiant de boutique manquant.',
      description: 'La description ne doit pas dépasser 40 caractères.',
      callback_info: 'Le champ callback_info est invalide.',
      first_name: 'Nom invalide.',
      otp: 'Code OTP invalide.',
    };
    const WAVE_CODES = {
      'insufficient-funds': 'Solde Wave insuffisant.',
      'blocked-account': 'Ce compte Wave est bloqué.',
      'recipient-account-blocked': 'Ce compte Wave est bloqué.',
      'recipient-account-inactive': "Ce compte Wave n'est pas actif.",
      'recipient-limit-exceeded': 'Le plafond de ce compte Wave est atteint.',
      'recipient-minor': 'Ce compte Wave ne peut pas effectuer ce paiement.',
      'country-mismatch': "Ce numéro n'est pas un compte Wave de ce pays.",
      'currency-mismatch': "Cette devise n'est pas acceptée par Wave.",
      'invalid-aggregated-merchant-id': "Le paiement Wave n'est pas activé pour ce marchand.",
      'aggregated-merchant-required': "Le paiement Wave n'est pas activé pour ce marchand.",
      'too-many-requests': 'Trop de tentatives. Veuillez patienter quelques instants.',
      'service-unavailable': 'Wave est momentanément indisponible. Veuillez réessayer plus tard.',
      'internal-server-error': 'Wave est momentanément indisponible. Veuillez réessayer plus tard.',
    };
    const MTN_CODES = {
      PAYER_NOT_FOUND: "Ce numéro n'a pas de compte MTN Mobile Money.",
      NOT_ENOUGH_FUNDS: 'Solde MTN Mobile Money insuffisant.',
      PAYER_LIMIT_REACHED: 'Le plafond de ce compte MTN Mobile Money est atteint.',
      NOT_ALLOWED: "Ce compte MTN Mobile Money n'est pas autorisé à payer.",
      NOT_ALLOWED_TARGET_ENVIRONMENT: "Ce compte MTN Mobile Money n'est pas autorisé à payer.",
      INVALID_CURRENCY: "Cette devise n'est pas acceptée par MTN.",
      SERVICE_UNAVAILABLE: 'MTN est momentanément indisponible. Veuillez réessayer plus tard.',
      INTERNAL_PROCESSING_ERROR: 'MTN est momentanément indisponible. Veuillez réessayer plus tard.',
      COULD_NOT_PERFORM_TRANSACTION: "MTN n'a pas pu effectuer la transaction. Veuillez réessayer.",
    };
    const BUSINESS_MESSAGES = [
      [/^Merchant or Shop not found$/i, "Boutique introuvable : vérifiez l'identifiant de la boutique et la clé API."],
      [/^Shop is disabled$/i, 'Cette boutique est désactivée. Contactez le marchand.'],
      [/Wave aggregated merchant not configured/i, "Le paiement Wave n'est pas encore activé pour ce marchand."],
      [/channel not configured/i, "Ce réseau n'est pas disponible pour le moment."],
      [/not available yet/i, "Ce réseau n'est pas encore disponible."],
      [/under maintenance|^Network Unavailable$/i, 'Ce réseau est en maintenance. Veuillez réessayer plus tard.'],
      [/otp is required/i, 'Le code OTP est requis.'],
      [/first_name and last_name are required/i, 'Veuillez renseigner votre nom et votre prénom : ils sont requis pour un premier paiement B-MO.'],
    ];
    const CODE_MESSAGES = {
      UNAUTHORIZED: 'Clé API invalide. Contactez le marchand.',
      API_KEY_BLOCKED: 'La clé API du marchand est bloquée. Contactez le marchand.',
      ACCESS_DENIED: "Ce moyen de paiement n'est pas activé pour ce marchand.",
      NETWORK_UNAVAILABLE: 'Ce réseau est en maintenance. Veuillez réessayer plus tard.',
      NOT_FOUND: 'Transaction introuvable.',
      INVALID_OTP: 'Code de confirmation invalide.',
      INVALID_CONFIRMATION_CODE: 'Code de confirmation invalide ou expiré.',
      ALREADY_FINALIZED: 'Cette transaction a déjà été traitée.',
    };

    const operatorName = (body) => {
      if (typeof body.code === 'string') {
        const key = body.code.replace(/_(API|COMMUNICATION)_ERROR$|_DISBURSEMENT_ERROR$/, '');
        if (OPERATORS[key]) return OPERATORS[key];
      }
      const match = typeof body.error === 'string' && body.error.match(/^(Wave|Orange|Free)/);
      return match ? match[1] : "l'opérateur";
    };

    // Le minimum/maximum varie selon le réseau (ex. B-MO : 200) : on reprend la limite renvoyée par l'API
    const fieldMessage = (e) => {
      if (!e) return null;
      if (e.property === 'amount' && Array.isArray(e.constraints)) {
        for (const c of e.constraints) {
          const min = String(c).match(/less than (\d+)/);
          if (min) return `Montant invalide : le minimum est de ${Number(min[1]).toLocaleString('fr-FR')}.`;
          const max = String(c).match(/greater than (\d+)/);
          if (max) return `Montant invalide : le maximum est de ${Number(max[1]).toLocaleString('fr-FR')}.`;
        }
      }
      return FIELD_MESSAGES[e.property];
    };

    const isPhoneField = (loc) => Array.isArray(loc) && loc.some((l) => /mobile|phone|msisdn/i.test(String(l)));

    const providerMessage = (operator, details) => {
      const fallback = `Le paiement a été refusé par ${operator}. Veuillez réessayer.`;
      if (!details) return fallback;
      if (typeof details === 'string') return `${operator} : ${details}`;
      const validation = Array.isArray(details.details) ? details.details : [];
      const phoneError = validation.find((d) => isPhoneField(d && d.loc));
      if (phoneError) {
        const phone = (String(phoneError.msg || '').match(/\+?\d{6,}/) || [])[0];
        return phone
          ? `Numéro de téléphone invalide pour ${operator} (${phone}). Vérifiez le numéro saisi.`
          : `Numéro de téléphone invalide pour ${operator}. Vérifiez le numéro saisi.`;
      }
      if (validation.some((d) => d && Array.isArray(d.loc) && d.loc.includes('amount'))) {
        return `Montant refusé par ${operator}.`;
      }
      if (WAVE_CODES[details.code]) return WAVE_CODES[details.code];
      if (MTN_CODES[details.code]) return MTN_CODES[details.code];
      const message = details.message || details.reason || details.error_description || details.error;
      if (typeof message === 'string' && message && !/^request invalid$/i.test(message)) {
        return `${operator} : ${message}`;
      }
      return fallback;
    };

    return (body, httpStatus, fallback = 'La demande de paiement a échoué. Veuillez réessayer.') => {
      const status = httpStatus || (body && body.statusCode);
      if (typeof status === 'number' && status >= 500) {
        return 'Service momentanément indisponible. Veuillez réessayer plus tard.';
      }
      if (!body || typeof body !== 'object') return fallback;

      if (Array.isArray(body.errors)) {
        const messages = body.errors
          .map((e) => fieldMessage(e) || (e && Array.isArray(e.constraints) ? e.constraints[0] : null))
          .filter(Boolean);
        if (messages.length) return Array.from(new Set(messages)).join(' ');
      }

      const isProviderError =
        (typeof body.code === 'string' && /_(API|DISBURSEMENT)_ERROR$/.test(body.code)) ||
        (typeof body.error === 'string' && /API Error$/.test(body.error));
      if (isProviderError) {
        const details = body.details != null ? body.details : (typeof body.message === 'object' ? body.message : null);
        return providerMessage(operatorName(body), details);
      }
      if (typeof body.code === 'string' && /_COMMUNICATION_ERROR$/.test(body.code)) {
        return `${operatorName(body)} est momentanément injoignable. Veuillez réessayer plus tard.`;
      }
      if (typeof body.code === 'string' && CODE_MESSAGES[body.code]) return CODE_MESSAGES[body.code];

      const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      if (typeof message === 'string' && message) {
        const known = BUSINESS_MESSAGES.find(([test]) => test.test(message));
        if (known) return known[1];
        if (message !== 'Validation failed' && message !== 'Bad Request') return message;
      }
      return fallback;
    };
  })();

  // URL de paiement renvoyée par l'API (Wave, Orange, banque…) : https uniquement,
  // pour ne jamais rediriger ni charger d'iframe vers javascript:, data:, http…
  // Lève une erreur (gérée par le .catch de la requête) si l'URL est invalide.
  const safePaymentUrl = (value) => {
    let url = null;
    try { url = new URL(String(value)); } catch (e) { /* URL invalide */ }
    if (!url || url.protocol !== 'https:') {
      throw new Error('FeexPay: URL de paiement refusée');
    }
    return url.toString();
  };

  // Redirection vers une URL fournie par le marchand (callback_url / error_callback_url)
  const redirectToMerchantUrl = (value, reference) => {
    let url = null;
    try { url = new URL(String(value), window.location.href); } catch (e) { /* URL invalide */ }
    if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
      console.error('FeexPay: callback_url invalide, redirection annulée');
      return;
    }
    if (reference) url.searchParams.set('ref', reference);
    window.location.assign(url.toString());
  };

  // Le débit inclura les frais : si le serveur n'a pas pu les calculer, on bloque le
  // bouton plutôt que d'afficher un total sans frais.
  const FEE_UNAVAILABLE_NOTE = '*Impossible de calculer les frais pour le moment. Veuillez réessayer.';
  const setPayButtonTotal = (payBtn, totalAmount) => {
    payBtn.textContent = `Payer ${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
    payBtn.disabled = false;
  };
  const setPayButtonFeeError = (payBtn) => {
    payBtn.textContent = 'Frais indisponibles';
    payBtn.disabled = true;
  };
  // </feexpay-shared>

  // Liste complète des pays (ISO 3166-1) pour le formulaire carte bancaire
  // Format : codeISO|Nom|drapeau|codePostalParDéfaut
  const CARD_COUNTRIES = `AF|Afghanistan|🇦🇫|;ZA|Afrique du Sud|🇿🇦|8001;AL|Albanie|🇦🇱|1001;AX|Îles Åland|🇦🇽|22100;DZ|Algérie|🇩🇿|16000;DE|Allemagne|🇩🇪|10115;AD|Andorre|🇦🇩|AD500;AO|Angola|🇦🇴|;AI|Anguilla|🇦🇮|;AQ|Antarctique|🇦🇶|;AG|Antigua-et-Barbuda|🇦🇬|;SA|Arabie saoudite|🇸🇦|11564;AR|Argentine|🇦🇷|C1000;AM|Arménie|🇦🇲|;AW|Aruba|🇦🇼|;AS|Samoa américaines|🇦🇸|96799;AU|Australie|🇦🇺|2000;AT|Autriche|🇦🇹|1010;AZ|Azerbaïdjan|🇦🇿|AZ1000;BS|Bahamas|🇧🇸|;BH|Bahreïn|🇧🇭|;BD|Bangladesh|🇧🇩|1000;BB|Barbados|🇧🇧|;BY|Bélarus|🇧🇾|;BE|Belgique|🇧🇪|1000;BZ|Belize|🇧🇿|;BJ|Bénin|🇧🇯|;BM|Bermudes|🇧🇲|;BT|Bhoutan|🇧🇹|;BO|Bolivie|🇧🇴|;BA|Bosnie-Herzégovine|🇧🇦|71000;BW|Botswana|🇧🇼|;BR|Brésil|🇧🇷|01000-000;BN|Brunei|🇧🇳|;BG|Bulgarie|🇧🇬|1000;BF|Burkina Faso|🇧🇫|;BI|Burundi|🇧🇮|;KH|Cambodge|🇰🇭|12000;CM|Cameroun|🇨🇲|;CA|Canada|🇨🇦|K1A 0B1;CV|Cap-Vert|🇨🇻|1100;KY|Îles Caïmans|🇰🇾|;CF|Centrafrique|🇨🇫|;TD|Tchad|🇹🇩|;CL|Chili|🇨🇱|;CN|Chine|🇨🇳|100000;CX|Île Christmas|🇨🇽|;CC|Îles Cocos|🇨🇨|;CO|Colombie|🇨🇴|110111;KM|Comores|🇰🇲|;CG|Congo|🇨🇬|;CD|Congo (RDC)|🇨🇩|;CK|Îles Cook|🇨🇰|;CR|Costa Rica|🇨🇷|10101;CI|Côte d'Ivoire|🇨🇮|;HR|Croatie|🇭🇷|10000;CU|Cuba|🇨🇺|10100;CW|Curaçao|🇨🇼|;CY|Chypre|🇨🇾|1010;CZ|Tchéquie|🇨🇿|110 00;DK|Danemark|🇩🇰|1050;DJ|Djibouti|🇩🇯|;DM|Dominique|🇩🇲|;DO|République dominicaine|🇩🇴|10101;EC|Équateur|🇪🇨|;EG|Égypte|🇪🇬|11511;SV|Salvador|🇸🇻|1101;GQ|Guinée équatoriale|🇬🇶|;ER|Érythrée|🇪🇷|;EE|Estonie|🇪🇪|10111;SZ|Eswatini|🇸🇿|;ET|Éthiopie|🇪🇹|;FO|Îles Féroé|🇫🇴|;FK|Îles Malouines|🇫🇰|;FJ|Fidji|🇫🇯|;FI|Finlande|🇫🇮|00100;FR|France|🇫🇷|75001;GF|Guyane française|🇬🇫|97300;PF|Polynésie française|🇵🇫|;GA|Gabon|🇬🇦|;GM|Gambie|🇬🇲|;GE|Géorgie|🇬🇪|;GH|Ghana|🇬🇭|;GI|Gibraltar|🇬🇮|;GG|Guernesey|🇬🇬|GY1 1AA;GR|Grèce|🇬🇷|10558;GL|Groenland|🇬🇱|3900;GD|Grenade|🇬🇩|;GP|Guadeloupe|🇬🇵|97100;GU|Guam|🇬🇺|96913;GT|Guatemala|🇬🇹|01001;GN|Guinée|🇬🇳|;GW|Guinée-Bissau|🇬🇼|;GY|Guyana|🇬🇾|;HT|Haïti|🇭🇹|;HN|Honduras|🇭🇳|11101;HK|Hong Kong|🇭🇰|;HU|Hongrie|🇭🇺|1051;IS|Islande|🇮🇸|101;IN|Inde|🇮🇳|110001;ID|Indonésie|🇮🇩|10110;IR|Iran|🇮🇷|;IQ|Iraq|🇮🇶|;IE|Irlande|🇮🇪|D02;IM|Île de Man|🇮🇲|;IL|Israël|🇮🇱|;IT|Italie|🇮🇹|00118;JM|Jamaïque|🇯🇲|;JP|Japon|🇯🇵|100-0001;JE|Jersey|🇯🇪|JE2 3AB;JO|Jordanie|🇯🇴|;KZ|Kazakhstan|🇰🇿|010000;KE|Kenya|🇰🇪|00100;KG|Kirghizistan|🇰🇬|;KI|Kiribati|🇰🇮|;XK|Kosovo|🇽🇰|10000;KP|Corée du Nord|🇰🇵|;KR|Corée du Sud|🇰🇷|;KW|Koweït|🇰🇼|;LA|Laos|🇱🇦|;LV|Lettonie|🇱🇻|LV-1010;LB|Liban|🇱🇧|;LR|Liberia|🇱🇷|;LY|Libye|🇱🇾|;LI|Liechtenstein|🇱🇮|;LT|Lituanie|🇱🇹|;LU|Luxembourg|🇱🇺|;MO|Macao|🇲🇴|;MK|Macédoine du Nord|🇲🇰|1000;MG|Madagascar|🇲🇬|101;MW|Malawi|🇲🇼|;MY|Malaisie|🇲🇾|50000;MV|Maldives|🇲🇻|;ML|Mali|🇲🇱|;MT|Malte|🇲🇹|;MH|Îles Marshall|🇲🇭|;MP|Îles Mariannes du Nord|🇲🇵|96950;MQ|Martinique|🇲🇶|97200;MR|Mauritanie|🇲🇷|;MU|Île Maurice|🇲🇺|;YT|Mayotte|🇾🇹|97600;MX|Mexique|🇲🇽|06600;FM|Micronésie|🇫🇲|;MD|Moldavie|🇲🇩|2001;MC|Monaco|🇲🇨|98000;MN|Mongolie|🇲🇳|;ME|Monténégro|🇲🇪|81000;MS|Montserrat|🇲🇸|;MA|Maroc|🇲🇦|10000;MZ|Mozambique|🇲🇿|;MM|Myanmar|🇲🇲|;NA|Namibie|🇳🇦|;NR|Nauru|🇳🇷|;NP|Népal|🇳🇵|;NL|Pays-Bas|🇳🇱|1012;BQ|Pays-Bas caribéens|🇧🇶|;NC|Nouvelle-Calédonie|🇳🇨|98800;NZ|Nouvelle-Zélande|🇳🇿|1010;NI|Nicaragua|🇳🇮|;NE|Niger|🇳🇪|;NG|Nigeria|🇳🇬|900001;NU|Niué|🇳🇺|;NF|Île Norfolk|🇳🇫|;NO|Norvège|🇳🇴|;OM|Oman|🇴🇲|;UG|Ouganda|🇺🇬|;UZ|Ouzbékistan|🇺🇿|100000;PK|Pakistan|🇵🇰|44000;PW|Palaos|🇵🇼|;PS|Palestine|🇵🇸|;PA|Panama|🇵🇦|;PG|Papouasie-Nouvelle-Guinée|🇵🇬|;PY|Paraguay|🇵🇾|;PE|Pérou|🇵🇪|;PH|Philippines|🇵🇭|1000;PN|Îles Pitcairn|🇵🇳|;PL|Pologne|🇵🇱|00-001;PT|Portugal|🇵🇹|;PR|Porto Rico|🇵🇷|00901;QA|Qatar|🇶🇦|;RE|La Réunion|🇷🇪|97400;RO|Roumanie|🇷🇴|010011;RU|Russie|🇷🇺|101000;RW|Rwanda|🇷🇼|;EH|Sahara occidental|🇪🇭|;BL|Saint-Barthélemy|🇧🇱|97133;KN|Saint-Christophe-et-Niévès|🇰🇳|;LC|Sainte-Lucie|🇱🇨|;SH|Sainte-Hélène|🇸🇭|;MF|Saint-Martin|🇲🇫|97150;SM|Saint-Marin|🇸🇲|47890;PM|Saint-Pierre-et-Miquelon|🇵🇲|97500;VC|Saint-Vincent-et-les-Grenadines|🇻🇨|;WS|Samoa|🇼🇸|;ST|Sao Tomé-et-Principe|🇸🇹|;SN|Sénégal|🇸🇳|;RS|Serbie|🇷🇸|11000;SC|Seychelles|🇸🇨|;SL|Sierra Leone|🇸🇱|;SG|Singapour|🇸🇬|;SX|Sint Maarten|🇸🇽|;SK|Slovaquie|🇸🇰|;SI|Slovénie|🇸🇮|1000;SB|Îles Salomon|🇸🇧|;SO|Somalie|🇸🇴|;SD|Soudan|🇸🇩|;SS|Soudan du Sud|🇸🇸|;ES|Espagne|🇪🇸|28013;LK|Sri Lanka|🇱🇰|;SE|Suède|🇸🇪|111 21;CH|Suisse|🇨🇭|8001;SR|Suriname|🇸🇷|;TZ|Tanzanie|🇹🇿|;TH|Thaïlande|🇹🇭|10100;TL|Timor oriental|🇹🇱|;TG|Togo|🇹🇬|;TO|Tonga|🇹🇴|;TT|Trinité-et-Tobago|🇹🇹|;TN|Tunisie|🇹🇳|1000;TR|Turquie|🇹🇷|06100;TM|Turkménistan|🇹🇲|;TC|Îles Turks et Caïques|🇹🇨|;TV|Tuvalu|🇹🇻|;TW|Taïwan|🇹🇼|;TJ|Tadjikistan|🇹🇯|;UA|Ukraine|🇺🇦|01001;AE|Émirats arabes unis|🇦🇪|;GB|Royume-Uni|🇬🇧|SW1A 1AA;US|États-Unis|🇺🇸|10001;UY|Uruguay|🇺🇾|11000;VU|Vanuatu|🇻🇺|;VA|Vatican|🇻🇦|00120;VE|Venezuela|🇻🇪|;VG|Îles Vierges britanniques|🇻🇬|;VI|Îles Vierges américaines|🇻🇮|;VN|Viêt Nam|🇻🇳|10000;WF|Wallis-et-Futuna|🇼🇫|98600;YE|Yémen|🇾🇪|;ZM|Zambie|🇿🇲|;ZW|Zimbabwe|🇿🇼|`
    .split(';')
    .filter(Boolean)
    .map(entry => {
      const parts = entry.split('|');
      return { code: parts[0], name: parts[1], flag: parts[2], zip: parts[3] || '' };
    });



  // Main FeexPayButton object to be exposed globally
  const FeexPayButton = {
    // Current payment method
    currentPaymentMethod: 'mobile',
    /**
     * Validate shop before displaying button
     * @param {string} shopId - ID of the shop to validate
     * @returns {Promise<boolean>} - Promise resolving to true if shop is valid
     */
    validateShop: function(shopId) {
      return new Promise((resolve, reject) => {
        if (!shopId) {
          // console.error('FeexPay: Shop ID is required for validation');
          resolve(false);
          return;
        }

        fetch(`${FeexPayConfig.baseUrl}/api/shop/${shopId}/get_shop`)
          .then(response => {
            if (response.status === 200) {
              response.json().then(data => {
                // console.log(data);
                // Stocker les informations du marchand pour utilisation dans la modale
                FeexPayConfig.merchantInfo = {
                  name: data.name,
                  reference: data.reference
                };
                resolve(true);
              });

            } else {
              // console.error(`FeexPay: Shop validation failed with status ${response.status}`);
              resolve(false);
            }
          })
          .catch(error => {
            // console.error('FeexPay: Shop validation error', error);
            resolve(false);
          });
      });
    },

    /**
     * Initialize the FeexPay button
     * @param {string} containerId - ID of the container element
     * @param {object} options - Configuration options
     */
    init: function(containerId, options) {
      if (!containerId) {
        // console.error('FeexPay: Container ID is required');
        return;
      }

      // Reset callback called flag for new initialization
      FeexPayConfig.callbackCalled = false;

      FeexPayConfig.containerId = containerId;
      FeexPayConfig.options = {
        id: options.id || '',
        amount: parseInt(parseInt(options.amount)) || 0,
        token: options.token || '',
        callback: options.callback || function() {},
        callback_url: options.callback_url || '',
        error_callback_url: options.error_callback_url || '',
        mode: options.mode || 'LIVE',
        custom_button: options.custom_button || false,
        id_custom_button: options.id_custom_button || '',
        custom_id: options.custom_id || '',
        description: options.description || '',
        fields_to_hide: options.fields_to_hide || [],
        callback_info: options.callback_info || '',
        currency : options.currency || 'XOF',
        case : options.case || 'ALL',
        resultModalElement : options.resultModalElement || null,
        networks: options.networks || null,
      };

      // Une nouvelle init (changement de montant, de moyen de paiement...) remplace
      // le modal et les styles précédents : sinon les anciens restent dans le DOM et
      // les document.getElementById(...) ciblent les éléments du premier modal.
      if (FeexPayConfig.modalElement) {
        FeexPayConfig.modalElement.remove();
        FeexPayConfig.modalElement = null;
      }
      if (FeexPayConfig.styles) {
        FeexPayConfig.styles.remove();
        FeexPayConfig.styles = null;
      }

      // Inject styles
      this.injectStyles();

      // Create modal (hidden initially)
      this.createModal();

      // Validate shop before creating button
      this.validateShop(FeexPayConfig.options.id).then(isValid => {
        FeexPayConfig.shopValid = isValid;

        if (!isValid) {
          // console.error(`FeexPay: Shop with ID "${FeexPayConfig.options.id}" is not valid`);
          // Still call createButton to display error message
          this.createButton();
          return;
        }

        // Create button or use custom button only if shop is valid
        if (FeexPayConfig.options.custom_button && FeexPayConfig.options.id_custom_button) {
          const customButton = document.getElementById(FeexPayConfig.options.id_custom_button);
          if (customButton) {
            customButton.addEventListener('click', this.showPaymentModal);
          } else {
            // console.error(`FeexPay: Custom button with ID "${FeexPayConfig.options.id_custom_button}" not found`);
          }
        } else {
          this.createButton();
        }
      });
    },

    /**
     * Inject required CSS styles
     */
    injectStyles: function() {
      FeexPayConfig.styles = document.createElement('style');
      FeexPayConfig.styles.textContent = `
      @import url('https://fonts.cdnfonts.com/css/gilroy-bold');
   
@import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');

        .feexpay-button {
          background-color: #D45D00;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 16px;
         font-family: 'Gilroy-Bold', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        
        .feexpay-button:hover {
          background-color: #ea580c;
        }
        
        .feexpay-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.3s, visibility 0.3s;
        }
        
        .feexpay-modal-overlay.active {
          opacity: 1;
          visibility: visible;
        }
        
        .feexpay-modal-overlay {
          padding: 16px;
          box-sizing: border-box;
          background-color: rgba(15, 23, 42, 0.55) !important;
          -webkit-backdrop-filter: blur(3px);
          backdrop-filter: blur(3px);
        }

        .feexpay-modal {
          font-family: 'Poppins', sans-serif;
          font-weight: 400;
          color: #1f2937;
          background-color: #ffffff;
          border-radius: 16px;
          max-width: 440px;
          width: 100%;
          max-height: calc(100vh - 32px);
          overflow-y: auto;
          box-shadow: 0 24px 48px -12px rgba(15, 23, 42, 0.35);
          transform: translateY(16px) scale(0.98);
          transition: transform 0.3s ease;
          -webkit-font-smoothing: antialiased;
        }

        .feexpay-modal-overlay.active .feexpay-modal {
          transform: translateY(0) scale(1);
        }

        .feexpay-modal *,
        .feexpay-modal *::before,
        .feexpay-modal *::after { box-sizing: border-box; }

        /* Typographie limitée aux modals FeexPay (ne pas styler la page du marchand) */
        .feexpay-modal-overlay h1,
        .feexpay-otp-modal-overlay h1 { font-family: 'Gilroy-Bold', sans-serif; font-size: 20px; font-weight: 600; }
        .feexpay-modal-overlay h2,
        .feexpay-otp-modal-overlay h2 { font-family: 'Gilroy-Bold', sans-serif; font-size: 18px; font-weight: 600; }
        .feexpay-modal-overlay h3,
        .feexpay-otp-modal-overlay h3 { font-family: 'Poppins', sans-serif; font-size: 16px; font-weight: 500; }
        .feexpay-modal-overlay p,
        .feexpay-otp-modal-overlay p { font-family: 'Poppins', sans-serif; font-size: 10px; font-weight: 400; }
        .feexpay-modal-overlay span,
        .feexpay-otp-modal-overlay span { font-family: 'Poppins', sans-serif; font-size: 14px; font-weight: 400; }

        /* En-tête */
        .feexpay-modal .fx-header {
          display: flex; align-items: center; gap: 12px;
          padding: 18px 20px 14px;
          border-bottom: 1px solid #f1f2f4;
        }
        .feexpay-modal .fx-logo { width: 112px; height: auto; display: block; }
        .feexpay-modal .fx-merchant {
          margin-left: auto; text-align: right; line-height: 1.35; min-width: 0;
        }
        .feexpay-modal .fx-merchant-name {
          display: block; font-size: 13px; font-weight: 600; color: #112C56;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;
        }
        .feexpay-modal .fx-merchant-id {
          display: block; font-size: 11px; color: #9ca3af; letter-spacing: .02em;
        }
        .feexpay-modal .fx-close {
          flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%;
          background: #f3f4f6; color: #4b5563; cursor: pointer;
          transition: background-color .15s, color .15s;
        }
        .feexpay-modal .fx-header .fx-logo + .fx-close { margin-left: auto; }
        .feexpay-modal .fx-close:hover { background: #e5e7eb; color: #111827; }

        .feexpay-modal .fx-body { padding: 16px 20px 20px; }
        .feexpay-modal .fx-intro {
          margin: 0 0 16px; text-align: center; font-size: 13px; color: #6b7280;
        }

        /* Choix du moyen de paiement */
        .feexpay-modal .fx-methods {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
          margin-bottom: 20px;
        }
        .feexpay-modal .fx-methods.fx-single { display: flex; justify-content: center; }
        .feexpay-modal .fx-methods.fx-single .feexpay-method-btn { min-width: 140px; }
        .feexpay-modal .feexpay-method-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
          padding: 12px 6px; cursor: pointer;
          font-family: 'Poppins', sans-serif; color: #374151;
          background: #ffffff; border: 1.5px solid #e5e7eb; border-radius: 12px;
          transition: border-color .15s, background-color .15s, box-shadow .15s, color .15s;
        }
        .feexpay-modal .feexpay-method-btn svg { stroke: #9ca3af; transition: stroke .15s; }
        .feexpay-modal .feexpay-method-btn span { font-size: 12px; font-weight: 500; color: inherit; }
        .feexpay-modal .feexpay-method-btn:hover { border-color: #f3b98a; }
        .feexpay-modal .feexpay-method-btn.active {
          color: #D45D00; border-color: #D45D00; background: #fff7ed;
          box-shadow: 0 0 0 3px rgba(212, 93, 0, .12);
        }
        .feexpay-modal .feexpay-method-btn.active svg { stroke: #D45D00; }

        /* Sections numérotées */
        .feexpay-modal .fx-section { margin-bottom: 16px; }
        .feexpay-modal .fx-section-head {
          display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
        }
        .feexpay-modal .fx-step {
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
          width: 24px; height: 24px; border-radius: 50%;
          background: #fff1e6; color: #D45D00; font-size: 12px; font-weight: 600;
        }
        .feexpay-modal .fx-section-title {
          margin: 0; font-family: 'Poppins', sans-serif; font-size: 15px; font-weight: 600; color: #112C56;
        }
        .feexpay-modal .fx-stack { display: flex; flex-direction: column; gap: 10px; }
        .feexpay-modal .fx-row-2 { display: grid; grid-template-columns: 2fr 3fr; gap: 10px; }

        /* Champs */
        .feexpay-modal .fx-input {
          width: 100%; height: 44px; padding: 0 12px; margin: 0;
          font-family: 'Poppins', sans-serif; font-size: 14px; color: #111827;
          background-color: #fff; border: 1px solid #d1d5db; border-radius: 10px;
          outline: none; transition: border-color .15s, box-shadow .15s;
          -webkit-appearance: none; appearance: none;
        }
        .feexpay-modal .fx-input::placeholder { color: #9ca3af; }
        .feexpay-modal .fx-input:hover { border-color: #9ca3af; }
        .feexpay-modal .fx-input:focus {
          border-color: #D45D00; box-shadow: 0 0 0 3px rgba(212, 93, 0, .15);
        }
        /* Neutralise le fond bleu de l'autocomplétion du navigateur */
        .feexpay-modal .fx-input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #fff inset;
          -webkit-text-fill-color: #111827;
        }
        .feexpay-modal select.fx-input {
          padding-right: 34px; cursor: pointer; text-overflow: ellipsis;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center;
        }
        .feexpay-modal .fx-upper { text-transform: uppercase; }
        .feexpay-modal .fx-phone {
          display: flex; align-items: stretch;
          border: 1px solid #d1d5db; border-radius: 10px; background: #fff; overflow: hidden;
          transition: border-color .15s, box-shadow .15s;
        }
        .feexpay-modal .fx-phone:hover { border-color: #9ca3af; }
        .feexpay-modal .fx-phone:focus-within {
          border-color: #D45D00; box-shadow: 0 0 0 3px rgba(212, 93, 0, .15);
        }
        .feexpay-modal .fx-dial {
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          min-width: 62px; padding: 0 10px; background: #f9fafb; border-right: 1px solid #e5e7eb;
        }
        .feexpay-modal .fx-dial span { font-size: 14px; font-weight: 500; color: #4b5563; }
        .feexpay-modal .fx-phone input {
          flex: 1; min-width: 0; height: 42px; padding: 0 12px; margin: 0;
          border: none; outline: none; background: transparent;
          font-family: 'Poppins', sans-serif; font-size: 14px; color: #111827;
        }
        .feexpay-modal .fx-phone input::placeholder { color: #9ca3af; }
        .feexpay-modal .fx-phone input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #fff inset;
          -webkit-text-fill-color: #111827;
        }
        .feexpay-modal .fx-hint { margin: 6px 2px 0; font-size: 12px; color: #6b7280; }

        /* Récapitulatif */
        .feexpay-modal .fx-recap {
          margin: 4px 0 20px; padding: 14px 16px;
          background: #f9fafb; border: 1px solid #eef0f3; border-radius: 12px;
        }
        .feexpay-modal .fx-recap-row {
          display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
          padding: 3px 0;
        }
        .feexpay-modal .fx-recap-row span { font-size: 13px; color: #6b7280; }
        .feexpay-modal .fx-recap-row span:last-child { color: #111827; font-weight: 500; }
        .feexpay-modal .fx-recap-row.fx-total {
          margin-top: 8px; padding-top: 10px; border-top: 1px dashed #d1d5db;
        }
        .feexpay-modal .fx-recap-row.fx-total span { font-size: 14px; font-weight: 600; color: #112C56; }
        .feexpay-modal .fx-recap-row.fx-total span:last-child { font-size: 16px; color: #D45D00; }
        .feexpay-modal .fx-recap-note { margin: 8px 0 0; font-size: 11px; color: #9ca3af; }

        /* Actions */
        .feexpay-modal .fx-actions { display: flex; align-items: center; gap: 10px; }
        .feexpay-modal .fx-back {
          display: inline-flex; align-items: center; gap: 4px; height: 46px; padding: 0 14px;
          color: #4b5563; background: transparent; border: 1px solid #e5e7eb; border-radius: 10px;
          cursor: pointer; transition: background-color .15s;
        }
        .feexpay-modal .fx-back span { font-size: 14px; font-weight: 500; color: inherit; }
        .feexpay-modal .fx-back:hover { background: #f3f4f6; }
        .feexpay-modal .fx-pay {
          flex: 1; display: inline-flex; align-items: center; justify-content: center;
          height: 46px; padding: 0 16px;
          font-family: 'Poppins', sans-serif; font-size: 15px; font-weight: 600; color: #fff;
          background: #D45D00; border: none; border-radius: 10px; cursor: pointer;
          box-shadow: 0 6px 16px -6px rgba(212, 93, 0, .6);
          transition: background-color .15s, transform .1s;
        }
        .feexpay-modal .fx-pay:hover { background: #bf5300; }
        .feexpay-modal .fx-pay:active { transform: translateY(1px); }
        .feexpay-modal .fx-pay:disabled { opacity: .7; cursor: not-allowed; }

        /* Pied de page */
        .feexpay-modal .fx-footer {
          padding: 12px 20px 14px; text-align: center;
          background: #f9fafb; border-top: 1px solid #f1f2f4;
        }
        .feexpay-modal .fx-footer p { margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.6; }
        .feexpay-modal .fx-footer .fx-secured {
          display: inline-flex; align-items: center; gap: 5px; font-weight: 500; color: #6b7280;
        }
        .feexpay-modal .fx-footer a { color: #D45D00; text-decoration: none; }
        .feexpay-modal .fx-footer a:hover { text-decoration: underline; }

        @media (max-width: 420px) {
          .feexpay-modal-overlay.feexpay-payment-overlay { padding: 0; align-items: flex-end; }
          .feexpay-modal { max-height: 100vh; border-radius: 16px 16px 0 0; }
          .feexpay-modal .fx-body { padding: 14px 16px 18px; }
          .feexpay-modal .fx-header { padding: 14px 16px 12px; }
          .feexpay-modal .fx-merchant-name { max-width: 130px; }
          .feexpay-modal .fx-row-2 { grid-template-columns: 1fr; }
        }

        /* Additional styles for modal content will be added dynamically */
        
        .feexpay-loading-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: #ffffff;
          animation: feexpay-spin 1s ease-in-out infinite;
          margin-right: 8px;
          vertical-align: middle;
        }

        @keyframes feexpay-spin {
          to { transform: rotate(360deg); }
        }

        /* Formulaire carte bancaire */
        #feexpay-card-section { padding: 0; }
        #feexpay-card-section * { box-sizing: border-box; }
        #feexpay-card-section .fx-card-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px;
        }
        #feexpay-card-section .fx-card-title {
          margin: 0; font-family: 'Poppins', sans-serif; font-size: 16px;
          font-weight: 600; color: #112C56;
        }
        #feexpay-card-section .fx-card-subtitle {
          margin: 2px 0 0; font-size: 12px; color: #6b7280;
        }
        #feexpay-card-section .fx-brands { display: flex; gap: 8px; }
        #feexpay-card-section .fx-brand {
          display: flex; align-items: center; justify-content: center;
          width: 64px; height: 40px; padding: 0;
          border: 1.5px solid #e5e7eb; border-radius: 8px; background: #fff;
          cursor: pointer; transition: border-color .15s, box-shadow .15s;
        }
        #feexpay-card-section .fx-brand:hover { border-color: #f3b98a; }
        #feexpay-card-section .fx-brand.active {
          border-color: #D45D00; box-shadow: 0 0 0 3px rgba(212, 93, 0, .12);
        }
        #feexpay-card-section .fx-brand-visa {
          font-family: Arial, sans-serif; font-size: 16px; font-weight: 900;
          font-style: italic; letter-spacing: .5px; color: #1A1F71;
        }
        #feexpay-card-section .fx-group {
          border: 1px solid #eef0f3; border-radius: 12px;
          padding: 14px; margin-bottom: 12px; background: #fff;
        }
        #feexpay-card-section .fx-group-title {
          display: flex; align-items: center; gap: 6px; margin: 0 0 12px;
          font-family: 'Poppins', sans-serif; font-size: 11px; font-weight: 600;
          letter-spacing: .06em; text-transform: uppercase; color: #6b7280;
        }
        #feexpay-card-section .fx-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        }
        #feexpay-card-section .fx-full { grid-column: 1 / -1; }
        #feexpay-card-section .fx-field { display: flex; flex-direction: column; min-width: 0; }
        #feexpay-card-section .fx-label {
          margin-bottom: 6px; font-family: 'Poppins', sans-serif;
          font-size: 12px; font-weight: 500; color: #374151;
        }
        #feexpay-card-section .fx-optional {
          font-size: 11px; font-weight: 400; color: #9ca3af;
          text-transform: none; letter-spacing: 0;
        }
        #feexpay-card-section .fx-summary {
          border-radius: 12px; padding: 14px; margin-top: 4px;
          background: #fff7ed; border: 1px solid #fde3cc;
        }
        #feexpay-card-section .fx-summary-row {
          display: flex; align-items: baseline; justify-content: space-between;
        }
        #feexpay-card-section .fx-summary-label { font-size: 13px; color: #4b5563; }
        #feexpay-card-section .fx-summary-amount {
          font-family: 'Poppins', sans-serif; font-size: 18px;
          font-weight: 600; color: #112C56;
        }
        #feexpay-card-section #feexpay-card-fee-note {
          margin: 6px 0 0; font-size: 11px; color: #6b7280;
        }
        #feexpay-card-section .fx-secure {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          margin: 12px 0 0; font-size: 11px; color: #6b7280;
        }
        @media (max-width: 380px) {
          #feexpay-card-section .fx-grid { grid-template-columns: 1fr; }
          #feexpay-card-section .fx-card-head { flex-direction: column; align-items: flex-start; gap: 12px; }
        }
      `;
      document.head.appendChild(FeexPayConfig.styles);
    },

    /**
     * Create the payment button
     */
    createButton: function() {
      const container = document.getElementById(FeexPayConfig.containerId);
      if (!container) {
        // console.error(`FeexPay: Container with ID "${FeexPayConfig.containerId}" not found`);
        return;
      }

      // Only create button if shop is valid
      if (FeexPayConfig.shopValid) {
        const button = document.createElement('button');
        button.className = 'feexpay-button';
        button.innerHTML = `Payer ${FeexPayConfig.options.amount} ${FeexPayConfig.options.currency}`;
        button.addEventListener('click', this.showPaymentModal);

        container.appendChild(button);
      } else {
        // Display error message when shop validation fails
        const errorMessage = document.createElement('div');
        errorMessage.className = 'feexpay-error-message';
        errorMessage.style.color = '#e11d48';
        errorMessage.style.padding = '10px';
        errorMessage.style.marginTop = '10px';
        errorMessage.style.backgroundColor = '#fff1f2';
        errorMessage.style.border = '1px solid #fecdd3';
        errorMessage.style.borderRadius = '4px';
        errorMessage.style.fontSize = '14px';
        errorMessage.innerHTML = 'Vos identifiants d\'intégration sont incorrects. Merci d\'utiliser la clé adéquate à votre environnement (LIVE ou SANDBOX) actuel';

        container.appendChild(errorMessage);
      }
    },

    /**
     * Create the payment modal
     */
    createModal: function() {
      // Create modal overlay
      const modalOverlay = document.createElement('div');
      modalOverlay.className = 'feexpay-modal-overlay feexpay-payment-overlay';

      // Create modal content
      const modal = document.createElement('div');
      modal.className = 'feexpay-modal';

      // We'll add modal content when the modal is shown

      // Close modal when clicking outside
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.hidePaymentModal();
        }
      });

      // Add modal to the overlay
      modalOverlay.appendChild(modal);

      // Add the overlay to the body
      document.body.appendChild(modalOverlay);

      // Store reference to the modal
      FeexPayConfig.modalElement = modalOverlay;
    },

    /**
     * Show the payment modal
     */
    showPaymentModal: function() {
      if (!FeexPayConfig.modalElement || !FeexPayConfig.shopValid) return;

      // Fill modal with content
      const modalContent = FeexPayConfig.modalElement.querySelector('.feexpay-modal');

      // Check which fields should be hidden
      const hideNameField = FeexPayConfig.options.fields_to_hide.includes('name');
      const hideEmailField = FeexPayConfig.options.fields_to_hide.includes('email');
      const hidePersonalInfoSection = hideNameField && hideEmailField;

      // Determine the starting section number based on whether personal info is hidden
      const paymentMethodsSectionNumber = hidePersonalInfoSection ? 1 : 2;

      // Build country options — filtered by options.networks if provided
      const allCountryDefs = [
        { value: 'Benin', label: '🇧🇯 Benin' },
        { value: 'Togo', label: '🇹🇬 Togo' },
        { value: "Côte d'Ivoire", label: "🇨🇮 Côte d'Ivoire" },
        { value: 'Burkina Faso', label: '🇧🇫 Burkina Faso' },
        { value: 'Senegal', label: '🇸🇳 Senegal' },
        { value: 'Congo-Brazzaville', label: '🇨🇬 Congo-Brazzaville' },
        // { value: 'Ghana', label: '🇬🇭 Ghana' },
      ];
      const allowedNetworks = FeexPayConfig.options.networks;
      const visibleCountries = allowedNetworks
        ? allCountryDefs.filter(c => allowedNetworks[c.value] && allowedNetworks[c.value].length > 0)
        : allCountryDefs;
      const countryOptionsHtml = visibleCountries
        .map(c => `<option value="${c.value}"> ${c.label}</option>`)
        .join('');

      // In a real implementation, this would render a full payment form
      // with inputs for personal info, payment method selection, etc.
      // For this demo, we'll use a simplified version

      const singleMethod = ['MOBILE', 'WALLET', 'CARD'].includes(FeexPayConfig.options.case)
        || FeexPayConfig.options.currency === 'USD' || FeexPayConfig.options.currency === 'CAD';

      modalContent.innerHTML = `
        <div class="fx-header">
          <img class="fx-logo" src="https://feexpay.me/_next/static/media/logo.65cc21ed.svg" alt="FeexPay">
          ${FeexPayConfig.merchantInfo ? `
            <div class="fx-merchant">
              <span class="fx-merchant-name">${escapeHtml(FeexPayConfig.merchantInfo.name)}</span>
              <span class="fx-merchant-id">ID : ${escapeHtml(FeexPayConfig.merchantInfo.reference)}</span>
            </div>
          ` : ''}
          <button type="button" id="feexpay-close-btn" class="fx-close" aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="fx-body">
          <p class="fx-intro">Remplissez les champs suivants pour effectuer votre paiement</p>

          <!-- Payment method selection -->
          <div id="feexpay-methods-container" class="fx-methods${singleMethod ? ' fx-single' : ''}">
            <button type="button" class="feexpay-method-btn active" data-method="mobile">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
              <span>Mobile Money</span>
            </button>

            <button type="button" class="feexpay-method-btn" data-method="card">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              <span>Carte bancaire</span>
            </button>

            <button type="button" class="feexpay-method-btn" data-method="wallet">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"></path>
                <path d="M23 11H17a2 2 0 0 0 0 4h6"></path>
              </svg>
              <span>Wallet</span>
            </button>
          </div>

          <!-- Personal Information -->
          <div id="feexpay-personal-info" class="fx-section" style="${hidePersonalInfoSection ? 'display: none;' : ''}">
            <div class="fx-section-head">
              <span class="fx-step">1</span>
              <h3 class="fx-section-title">Informations personnelles</h3>
            </div>
            <div class="fx-stack">
              <input class="fx-input fx-upper" oninput="this.value = this.value.toUpperCase()" type="text" id="feexpay-name-input" placeholder="Nom et prénoms" autocomplete="name" style="${hideNameField ? 'display: none;' : ''}">
              <input class="fx-input" type="email" id="feexpay-email-input" placeholder="Adresse email" autocomplete="email" inputmode="email" style="${hideEmailField ? 'display: none;' : ''}">
            </div>
          </div>

          <!-- Payment Methods -->
          <div id="feexpay-payment-methods" class="fx-section">
            <div class="fx-section-head">
              <span class="fx-step">${paymentMethodsSectionNumber}</span>
              <h3 class="fx-section-title">Méthode de paiement</h3>
            </div>
            <div class="fx-stack">
              <div class="fx-row-2">
                <select id="feexpay-country-select" class="fx-input" aria-label="Pays">
                  ${countryOptionsHtml}
                </select>
                <select id="feexpay-network-select" class="fx-input" aria-label="Réseau">
                  <!-- Options will be populated dynamically based on country selection -->
                </select>
              </div>

              <div class="fx-phone">
                <div id="feexpay-country-code" class="fx-dial">
                  <span>+229</span>
                </div>
                <input type="tel" placeholder="Numéro de téléphone sans indicatif" autocomplete="tel-national" inputmode="tel">
              </div>

              <!-- OTP field for Senegal ORANGE -->
              <div id="feexpay-otp-field" style="display: none;">
                <input type="text" id="feexpay-otp-input" class="fx-input" placeholder="Code OTP" inputmode="numeric" autocomplete="one-time-code">
                <p class="fx-hint">L'OTP de validation de la transaction s'obtient en tapant #144#391#</p>
              </div>
            </div>
          </div>

          <!-- Payment Summary -->
          <div id="feexpay-payment-summary" class="fx-recap">
            <div class="fx-recap-row">
              <span>Montant</span>
              <span>${FeexPayConfig.options.amount.toLocaleString()} ${FeexPayConfig.options.currency}</span>
            </div>
            <div id="feexpay-fee-display" class="fx-recap-row">
              <span>Frais</span>
              <span id="feexpay-mobile-fee-value"></span>
            </div>
            <div id="feexpay-total-display" class="fx-recap-row fx-total">
              <span>Total à payer</span>
              <span id="feexpay-total-label">${Math.ceil(FeexPayConfig.options.amount * 1.017).toLocaleString()} ${FeexPayConfig.options.currency}</span>
            </div>
            <p id="feexpay-fee-note" class="fx-recap-note">
              *Des frais de transaction sont applicables au montant.
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="fx-actions">
            <button type="button" id="feexpay-back-btn" class="fx-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <span>Retour</span>
            </button>
            <button type="button" id="feexpay-pay-btn" class="fx-pay">
              Payer ${Math.ceil(FeexPayConfig.options.amount).toLocaleString()} ${FeexPayConfig.options.currency}
            </button>
          </div>
        </div>

        <div class="fx-footer">
          <p class="fx-secured">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Paiements sécurisés par FeexPay
          </p>
          <p>En payant par ce plugin, vous acceptez les <a target="_blank" rel="noopener" href="https://feexpay.me/fr/terms-and-conditions">conditions générales d'utilisation</a> de FeexPay</p>
        </div>
      `;

      // Payment method sections
      const mobileSection = modalContent.querySelector('#feexpay-payment-methods');
      // Tous les pays disponibles pour le formulaire carte bancaire
      const cardCountryOptionsHtml = CARD_COUNTRIES
        .map(c => `<option value="${c.code}">${c.flag} ${c.name}</option>`)
        .join('');
      const cardSection = document.createElement('div');
      cardSection.id = 'feexpay-card-section';
      cardSection.style.display = 'none';
      cardSection.innerHTML = `
        <div style="margin-bottom: 24px;">
          <div class="fx-card-head">
            <div>
              <h3 class="fx-card-title">Paiement par carte bancaire</h3>
              <p class="fx-card-subtitle">Choisissez le réseau de votre carte</p>
            </div>
            <!-- La valeur est lue par processCardPayment() -->
            <input type="hidden" id="feexpay-card-type" value="VISA">
            <div class="fx-brands" role="radiogroup" aria-label="Réseau de la carte">
              <button type="button" class="fx-brand active" data-card-type="VISA" role="radio" aria-checked="true" aria-label="Visa">
                <span class="fx-brand-visa">VISA</span>
              </button>
              <button type="button" class="fx-brand" data-card-type="MASTERCARD" role="radio" aria-checked="false" aria-label="Mastercard">
                <svg width="34" height="22" viewBox="0 0 34 22" aria-hidden="true">
                  <circle cx="12" cy="11" r="10" fill="#EB001B"/>
                  <circle cx="22" cy="11" r="10" fill="#F79E1B"/>
                  <path d="M17 2.34a10 10 0 0 1 0 17.32 10 10 0 0 1 0-17.32z" fill="#FF5F00"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="fx-group">
            <p class="fx-group-title">Titulaire de la carte</p>
            <div class="fx-grid">
              <label class="fx-field">
                <span class="fx-label">Prénom</span>
                <input class="fx-input fx-upper" oninput="this.value = this.value.toUpperCase()" type="text" id="feexpay-firstname-input" placeholder="JEAN" autocomplete="given-name">
              </label>
              <label class="fx-field">
                <span class="fx-label">Nom</span>
                <input class="fx-input fx-upper" oninput="this.value = this.value.toUpperCase()" type="text" id="feexpay-lastname-input" placeholder="DUPONT" autocomplete="family-name">
              </label>
              <label class="fx-field fx-full">
                <span class="fx-label">Adresse email</span>
                <input class="fx-input" type="email" id="feexpay-card-email-input" placeholder="vous@exemple.com" autocomplete="email" inputmode="email">
              </label>
              <label class="fx-field fx-full">
                <span class="fx-label">Téléphone</span>
                <input class="fx-input" type="tel" id="feexpay-card-phone-input" placeholder="+229 01 00 00 00 00" autocomplete="tel" inputmode="tel">
              </label>
            </div>
          </div>

          <div class="fx-group">
            <p class="fx-group-title">Adresse de facturation <span class="fx-optional">(facultatif)</span></p>
            <div class="fx-grid">
              <label class="fx-field fx-full">
                <span class="fx-label">Pays</span>
                <select class="fx-input" id="feexpay-card-country-input" autocomplete="country">
                  <option value="">Sélectionner un pays</option>
                  ${cardCountryOptionsHtml}
                </select>
              </label>
              <label class="fx-field fx-full">
                <span class="fx-label">Adresse</span>
                <input class="fx-input" type="text" id="feexpay-card-adress-input" placeholder="Rue, quartier" autocomplete="address-line1">
              </label>
              <label class="fx-field">
                <span class="fx-label">Ville</span>
                <input class="fx-input" type="text" id="feexpay-card-city-input" placeholder="Cotonou" autocomplete="address-level2">
              </label>
              <label class="fx-field">
                <span class="fx-label">Code postal</span>
                <input class="fx-input" type="text" id="feexpay-card-zip-input" placeholder="Code postal" autocomplete="postal-code">
              </label>
            </div>
          </div>

          <!-- Résumé du paiement par carte -->
          <div id="feexpay-card-payment-summary" class="fx-summary">
            <div class="fx-summary-row">
              <span class="fx-summary-label">Montant à payer</span>
              <span class="fx-summary-amount">${FeexPayConfig.options.amount.toLocaleString()} ${FeexPayConfig.options.currency}</span>
            </div>
            <p id="feexpay-card-fee-note">
              *Les frais de transaction sont appliqués selon la zone émetteur de la carte.
            </p>
          </div>

          <p class="fx-secure">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Vous serez redirigé vers une page de paiement sécurisée
          </p>
        </div>
      `;

      // Insert card section after the payment methods section
      mobileSection?.parentNode.insertBefore(cardSection, mobileSection.nextSibling);

      // Sélection du réseau de la carte (VISA / MASTERCARD)
      const cardTypeInput = cardSection.querySelector('#feexpay-card-type');
      cardSection.querySelectorAll('.fx-brand').forEach(brandBtn => {
        brandBtn.addEventListener('click', function() {
          cardSection.querySelectorAll('.fx-brand').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-checked', 'false');
          });
          this.classList.add('active');
          this.setAttribute('aria-checked', 'true');
          cardTypeInput.value = this.dataset.cardType;
        });
      });

      // Remplir automatiquement le code postal selon le pays sélectionné (paiement carte)
      const cardCountrySelect = cardSection.querySelector('#feexpay-card-country-input');
      const cardZipInput = cardSection.querySelector('#feexpay-card-zip-input');
      if (cardCountrySelect) {
        cardCountrySelect.addEventListener('change', function() {
          const selectedCountry = CARD_COUNTRIES.find(c => c.code === this.value);
          if (cardZipInput) {
            cardZipInput.value = selectedCountry ? selectedCountry.zip : '';
            cardZipInput.placeholder = selectedCountry && selectedCountry.zip
              ? `Code postal (ex : ${selectedCountry.zip})`
              : 'Code postal';
          }
        });
      }

      // Wallet section
      const walletSection = document.createElement('div');
      walletSection.id = 'feexpay-wallet-section';
      walletSection.style.display = 'none';
      walletSection.innerHTML = `
        <div class="fx-section">
          <div class="fx-section-head">
            <span class="fx-step">${paymentMethodsSectionNumber}</span>
            <h3 class="fx-section-title">Méthode de paiement</h3>
          </div>

          <div class="fx-stack">
            <div class="fx-row-2">
              <select id="feexpay-wallet-country-select" class="fx-input" aria-label="Pays">
                  ${(() => {
        const allWalletCountries = [
          { value: 'Benin', label: '🇧🇯 Benin' },
          { value: "Côte d'Ivoire", label: "🇨🇮 Côte d'Ivoire" },
          { value: 'Senegal', label: '🇸🇳 Senegal' },
          {value :'Burkina Faso', label: '🇧🇫 Burkina Faso'}
        ];
        const filtered = allowedNetworks
          ? allWalletCountries.filter(c => allowedNetworks[c.value] && allowedNetworks[c.value].length > 0 && walletProviders[c.value])
          : allWalletCountries.filter(c => walletProviders[c.value]);
        return filtered.map(c => `<option value="${c.value}"> ${c.label}</option>`).join('');
      })()}
              </select>
              <select id="feexpay-wallet-provider-select" class="fx-input" aria-label="Wallet">
                <!-- Options will be populated dynamically based on country selection -->
              </select>
            </div>

            <div class="fx-phone">
              <div id="feexpay-wallet-country-code" class="fx-dial">
                <span>+229</span>
              </div>
              <input type="tel" id="feexpay-wallet-phone-input" placeholder="Numéro de téléphone sans indicatif" autocomplete="tel-national" inputmode="tel">
            </div>
          </div>
        </div>

        <!-- Résumé du paiement par wallet -->
        <div id="feexpay-wallet-payment-summary" class="fx-recap">
          <div class="fx-recap-row">
            <span>Montant</span>
            <span>${FeexPayConfig.options.amount.toLocaleString()} ${FeexPayConfig.options.currency}</span>
          </div>
          <div id="feexpay-wallet-fee-display" class="fx-recap-row">
            <span>Frais</span>
            <span id="feexpay-wallet-fee-value"></span>
          </div>
          <div id="feexpay-wallet-total-display" class="fx-recap-row fx-total">
            <span>Total à payer</span>
            <span id="feexpay-wallet-total-label"></span>
          </div>
          <p id="feexpay-wallet-fee-note" class="fx-recap-note">
            *Des frais de transaction sont applicables au montant.
          </p>
        </div>
      `;

      // Insert wallet section after the card section
      cardSection?.parentNode.insertBefore(walletSection, cardSection.nextSibling);

      // Add event listeners
      const closeBtn = modalContent.querySelector('#feexpay-close-btn');
      const backBtn = modalContent.querySelector('#feexpay-back-btn');
      const payBtn = modalContent.querySelector('#feexpay-pay-btn');
      const methodBtns = modalContent.querySelectorAll('.feexpay-method-btn');
      const personalInfoSection = document.getElementById('feexpay-personal-info');

      // Method selection handling
      // Déterminer la méthode de paiement initiale en fonction du paramètre case et de la devise
      let currentMethod = 'mobile'; // Par défaut

      // Si la devise est USD ou CAD, on affiche uniquement CARD
      if (FeexPayConfig.options.currency === 'USD' || FeexPayConfig.options.currency === 'CAD') {
        currentMethod = 'card';
      }
      // Sinon, on utilise le paramètre case
      else if (FeexPayConfig.options.case === 'MOBILE') {
        currentMethod = 'mobile';
      } else if (FeexPayConfig.options.case === 'CARD') {
        currentMethod = 'card';
      } else if (FeexPayConfig.options.case === 'WALLET') {
        currentMethod = 'wallet';
      }

      // Appliquer la configuration initiale en fonction de la méthode sélectionnée
      if (FeexPayConfig.options.currency === 'USD' || FeexPayConfig.options.currency === 'CAD' || FeexPayConfig.options.case !== 'ALL') {
        // Masquer les boutons non pertinents et activer le bouton correspondant
        methodBtns.forEach(btn => {
          if (btn.dataset.method !== currentMethod) {
            btn.classList.remove('active');
            btn.style.display = 'none';
          } else {
            // Activer le bouton correspondant
            btn.classList.add('active');
          }
        });

        // Afficher la section correspondante
        if (currentMethod === 'card') {

          if (mobileSection) mobileSection.style.display = 'none';

          cardSection.style.display = 'block';

          walletSection.style.display = 'none';
          if (personalInfoSection) personalInfoSection.style.display = 'none';

          // Cacher le résumé de paiement Mobile Money
          const mobileSummary = document.getElementById('feexpay-payment-summary');
          if (mobileSummary) mobileSummary.style.display = 'none';

          // Mettre à jour les informations de la carte plus tard
          // L'appel à updateCardInformation sera fait après l'initialisation de toutes les fonctions
        } else if (currentMethod === 'wallet') {
          if (mobileSection) mobileSection.style.display = 'none';
          cardSection.style.display = 'none';
          walletSection.style.display = 'block';

          // Cacher le résumé de paiement Mobile Money
          const mobileSummary = document.getElementById('feexpay-payment-summary');
          if (mobileSummary) mobileSummary.style.display = 'none';
        } else {
          // Mobile par défaut
          if (mobileSection) mobileSection.style.display = 'block';
          cardSection.style.display = 'none';
          walletSection.style.display = 'none';
          if (personalInfoSection && !hidePersonalInfoSection) personalInfoSection.style.display = 'block';
        }
      }

      methodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          // Remove active class from all buttons
          methodBtns.forEach(b => {
            b.classList.remove('active');
          });

          // Add active class to clicked button
          this.classList.add('active');

          // Update current method
          currentMethod = this.dataset.method;

          // Show/hide appropriate sections
          // personalInfoSection est déjà défini plus haut
          // Always hide personal info section if both name and email are hidden
          if (hidePersonalInfoSection && personalInfoSection) {
            personalInfoSection.style.display = 'none';
          }

          if (currentMethod === 'card') {
            if (mobileSection) mobileSection.style.display = 'none';
            // alert('Les paiements par carte bancaire sont indisponible pour le moment.')
            cardSection.style.display = 'block';
            walletSection.style.display = 'none';

            if (personalInfoSection) personalInfoSection.style.display = 'none';

            // Cacher le résumé de paiement Mobile Money
            const mobileSummary = document.getElementById('feexpay-payment-summary');
            if (mobileSummary) mobileSummary.style.display = 'none';

            // Mettre à jour les informations de la carte (frais et montant total)
            updateCardInformation();
          } else if (currentMethod === 'wallet') {
            if (mobileSection) mobileSection.style.display = 'none';
            cardSection.style.display = 'none';
            walletSection.style.display = 'block';

            // Toujours masquer la section Informations Personnelles pour le mode Wallet quand fields_to_hide est défini
            if (personalInfoSection) {
              const hideNameField = FeexPayConfig.options.fields_to_hide.includes('name');
              const hideEmailField = FeexPayConfig.options.fields_to_hide.includes('email');
              const hidePersonalInfoSection = hideNameField && hideEmailField;

              if (hidePersonalInfoSection) {
                personalInfoSection.style.display = 'none';
              } else {
                personalInfoSection.style.display = 'block';
              }
            }

            // Cacher le résumé de paiement Mobile Money
            const mobileSummary = document.getElementById('feexpay-payment-summary');
            if (mobileSummary) mobileSummary.style.display = 'none';

            // Mettre à jour le bouton de paiement pour le mode Wallet
            if (payBtn) {
              // Afficher l'état de chargement
              payBtn.textContent = '';

              // Préparer les données pour la requête
              const country = walletCountrySelect.value;
              const provider = walletProviderSelect.value || (walletProviders[country] && walletProviders[country][0]);

              if (provider) {
                fetchTransactionFees(getFeeReseau(country, provider))
                  .then(({ totalAmount }) => {
                    // Mettre à jour le texte du bouton
                    setPayButtonTotal(payBtn, totalAmount);
                  })
                  .catch(() => {
                    setPayButtonFeeError(payBtn);
                  });
              } else {
                // Si aucun fournisseur n'est disponible, afficher le montant sans frais
                payBtn.textContent = `Payer ${FeexPayConfig.options.amount.toLocaleString()} ${FeexPayConfig.options.currency}`;
              }
            }
          } else {
            if (mobileSection) mobileSection.style.display = 'block';
            cardSection.style.display = 'none';
            if (personalInfoSection && !hidePersonalInfoSection) personalInfoSection.style.display = 'block';

            // Réafficher le résumé de paiement Mobile Money
            const mobileSummary = document.getElementById('feexpay-payment-summary');
            if (mobileSummary) mobileSummary.style.display = 'block';
            walletSection.style.display = 'none';

            // Recalculer frais et libellé du bouton pour le réseau Mobile Money sélectionné
            updateFeeInformation(countrySelect.value, networkSelect.value);
          }
        });
      });

      if (closeBtn) closeBtn.addEventListener('click', function() {
        FeexPayButton.hidePaymentModal();
      });

      if (backBtn) backBtn.addEventListener('click', function() {
        FeexPayButton.hidePaymentModal();
      });

      if (payBtn) {
        payBtn.addEventListener('click', function() {
          if (currentMethod === 'card') {
            FeexPayButton.processCardPayment();
          } else if (currentMethod === 'wallet') {
            FeexPayButton.processWalletPayment();
          } else {
            FeexPayButton.processPayment();
          }
        });
      }

      // Country and network selection
      const countrySelect = modalContent.querySelector('#feexpay-country-select');
      const networkSelect = modalContent.querySelector('#feexpay-network-select');

      // Define networks by country
      const networksByCountry = {
        'Benin': ['MTN', 'MOOV', 'CELTIIS'],
        'Togo': ['YAS', 'MOOV'],
        'Côte d\'Ivoire': ['MTN', 'ORANGE', 'MOOV', ],
        'Burkina Faso': ['ORANGE', 'MOOV'],
        'Senegal': ['ORANGE', 'FREE MONEY', 'WAVE'],
        'Congo-Brazzaville': ['MTN'],
        'Ghana': ['MTN', 'AIRTEL', 'VODAFONE']
      };

      // Use the globally defined networkApiIds and networksRequiringOtp

      // Define country codes
      const countryCodes = {
        'Benin': '+229',
        'Togo': '+228',
        'Côte d\'Ivoire': '+225',
        'Burkina Faso': '+226',
        'Senegal': '+221',
        'Congo-Brazzaville': '+242',
        'Ghana': '+233'
      };

      // Function to update network options, country code, and fee information
      const updateNetworkOptions = (country) => {
        // Clear existing options
        networkSelect.innerHTML = '';

        // Add new options based on selected country, filtered by options.networks if provided
        const allNetworks = networksByCountry[country] || [];
        const merchantNetworks = FeexPayConfig.options.networks && FeexPayConfig.options.networks[country];
        const networks = merchantNetworks
          ? allNetworks.filter(n => {
            const apiId = (networkApiIds[country] && networkApiIds[country][n]) || '';
            return merchantNetworks.some(m =>
              m.toUpperCase() === n.toUpperCase() ||
              m.toUpperCase() === apiId.toUpperCase()
            );
          })
          : allNetworks;
        networks.forEach(network => {
          const option = document.createElement('option');
          option.value = network;
          option.textContent = network;
          networkSelect.appendChild(option);
        });

        // Update country code
        const countryCodeElement = modalContent.querySelector('#feexpay-country-code span');
        if (countryCodeElement) {
          countryCodeElement.textContent = countryCodes[country] || '+229';
        }

        // Update fee information based on country and first network
        updateFeeInformation(country, networks[0]);
      };

      // Function to update fee information based on country and network
      let feeRequestId = 0;
      const updateFeeInformation = (country, network) => {
        // Ignorer les réponses d'un réseau sélectionné précédemment
        const requestId = ++feeRequestId;

        // Show loading state
        const feeDisplay = modalContent.querySelector('#feexpay-fee-display span:last-child');
        const totalDisplay = modalContent.querySelector('#feexpay-total-label');
        const feeNote = modalContent.querySelector('#feexpay-fee-note');
        const payBtn = modalContent.querySelector('#feexpay-pay-btn');
        const mobileFeeValue = modalContent.querySelector('#feexpay-mobile-fee-value');

        if (feeDisplay) feeDisplay.textContent = '';
        if (totalDisplay) totalDisplay.textContent = '';
        if (mobileFeeValue) mobileFeeValue.textContent = '';

        // Make API request to get fees computed by the server
        fetchTransactionFees(getFeeReseau(country, network))
          .then(feeInfo => {
            if (requestId !== feeRequestId) return;
            const { shouldApplyFees, feeAmount, totalAmount } = feeInfo;
            // Mettre à jour l'affichage des frais
            if (mobileFeeValue) {
              mobileFeeValue.textContent = `${feeAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            }

            // Update fee display
            const feeDisplayRow = modalContent.querySelector('#feexpay-fee-display');
            if (feeDisplayRow) {
              if (shouldApplyFees) {
                feeDisplayRow.style.display = 'flex';
                if (feeDisplay) {
                  feeDisplay.textContent = `${feeAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
                }
              } else {
                // Masquer complètement la ligne des frais si aucun frais n'est applicable
                // feeDisplayRow.style.display = '';
              }
            }

            // Update total amount display
            // console.log('FeexPay: Total display element:', totalDisplay);
            if (totalDisplay) {
              // console.log('FeexPay: Updating total display with:', `${totalAmount.toLocaleString()} FCFA`);
              totalDisplay.textContent = `${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            } else {
              // console.log('FeexPay: Total display element not found, trying direct selection');
              const directTotalLabel = modalContent.querySelector('#feexpay-total-label');
              if (directTotalLabel) {
                // console.log('FeexPay: Found total label by direct selection');
                directTotalLabel.textContent = `${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
              }
            }

            // Update fee note
            if (feeNote) {
              feeNote.style.display = '';
              feeNote.textContent = formatFeeNote(feeInfo);
            }

            // Update pay button text
            if (payBtn && currentMethod === 'mobile') {
              setPayButtonTotal(payBtn, totalAmount);
            }
          })
          .catch(() => {
            if (requestId !== feeRequestId) return;

            // Masquer la ligne des frais en cas d'erreur
            const feeDisplayRow = modalContent.querySelector('#feexpay-fee-display');
            if (feeDisplayRow) {
              feeDisplayRow.style.display = 'none';
            }

            if (totalDisplay) totalDisplay.textContent = '';

            if (feeNote) {
              feeNote.style.display = '';
              feeNote.textContent = FEE_UNAVAILABLE_NOTE;
            }

            if (payBtn && currentMethod === 'mobile') {
              setPayButtonFeeError(payBtn);
            }
          });
      };

      // Function to update card fee information
      const updateCardInformation = () => {
        // Les frais dépendent de la zone émetteur de la carte : aucun taux
        // fixe n'est appliqué côté SDK, seule la note est mise à jour.
        const feeNoteIfFees = '*Les frais de transaction sont appliqués selon la zone émetteur de la carte.';
        const feeNoteNoFees = '*Aucun frais de transaction applicable pour cette transaction.';
        const payLabel = `Payer ${FeexPayConfig.options.amount.toLocaleString()} ${FeexPayConfig.options.currency}`;

        // Récupérer les éléments du DOM
        const cardFeeNote = document.getElementById('feexpay-card-fee-note');
        const payBtn = document.getElementById('feexpay-pay-btn');

        // Préparer les données pour la requête
        const requestData = {
          amount: FeexPayConfig.options.amount,
          reseau: 'CARD', // Type de réseau pour les cartes
          shop: FeexPayConfig.options.id
        };

        // Faire la requête API pour vérifier si des frais s'appliquent
        fetch(`${FeexPayConfig.baseUrl}/api/transactions/details`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        })
          .then(response => response.json())
          .then(data => {
            // Déterminer si les frais doivent être appliqués
            const shouldApplyFees = data.iffees === true;

            // Mettre à jour la note sur les frais
            if (cardFeeNote) {
              cardFeeNote.textContent = shouldApplyFees ? feeNoteIfFees : feeNoteNoFees;
            }

            // Mettre à jour le bouton de paiement si on est en mode carte
            if (payBtn && currentMethod === 'card') {
              payBtn.textContent = payLabel;
              payBtn.disabled = false;
            }
          })
          .catch(error => {
            // En cas d'erreur, conserver la note par défaut (zone émetteur)
            if (cardFeeNote) cardFeeNote.textContent = feeNoteIfFees;
            if (payBtn && currentMethod === 'card') {
              payBtn.textContent = payLabel;
              payBtn.disabled = false;
            }
          });
      };

      // Initialize network options for default country
      updateNetworkOptions(countrySelect.value);

      // Initialize card information
      updateCardInformation();

      // Function to toggle OTP field visibility based on country and network
      const toggleOtpField = (country, network) => {
        const otpField = document.getElementById('feexpay-otp-field');
        if (otpField) {
          if (country === 'Burkina Faso' && network === 'ORANGE') {
            const otpHint = otpField.querySelector('p');
            if (otpHint) otpHint.textContent = "Code Otp";
            otpField.style.display = 'block';
          } else {
            otpField.style.display = 'none';
          }
        }
      };

      // Update network options, country code, and fee information when country changes
      countrySelect.addEventListener('change', function() {
        updateNetworkOptions(this.value);
        // Check if we need to show/hide OTP field after network options are updated
        toggleOtpField(this.value, networkSelect.value);
      });

      // Update fee information when network changes
      networkSelect.addEventListener('change', function() {
        // updateFeeInformation interroge /api/transactions/details et met à jour
        // les frais, le total et le libellé du bouton avec les valeurs serveur.
        updateFeeInformation(countrySelect.value, this.value);
        // Check if we need to show/hide OTP field
        toggleOtpField(countrySelect.value, this.value);
      });

      // Initialize OTP field visibility
      toggleOtpField(countrySelect.value, networkSelect.value);

      // Wallet functionality
      const walletCountrySelect = modalContent.querySelector('#feexpay-wallet-country-select');
      const walletProviderSelect = modalContent.querySelector('#feexpay-wallet-provider-select');
      const walletCountryCode = modalContent.querySelector('#feexpay-wallet-country-code span');

      // Function to update wallet fee information based on country and provider
      // Les frais/montants proviennent du serveur (/api/transactions/details) : aucune
      // estimation locale, afin de rester aligné sur le montant réellement débité.
      const updateWalletFeeInformation = (country, provider) => {
        // Afficher l'état de chargement
        const feeValueElement = document.getElementById('feexpay-wallet-fee-value');
        const totalLabelElement = document.getElementById('feexpay-wallet-total-label');
        const feeNoteElement = document.getElementById('feexpay-wallet-fee-note');

        if (feeValueElement) feeValueElement.textContent = '';
        if (totalLabelElement) totalLabelElement.textContent = '';

        // Faire une requête API pour récupérer les frais calculés par le serveur
        fetchTransactionFees(getFeeReseau(country, provider))
          .then(feeInfo => {
            const { feeAmount, totalAmount } = feeInfo;

            // Mettre à jour l'affichage des frais
            if (feeValueElement) {
              feeValueElement.textContent = `${feeAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            }

            // Mettre à jour l'affichage du montant total
            if (totalLabelElement) {
              totalLabelElement.textContent = `${totalAmount.toLocaleString()} ${FeexPayConfig.options.currency}`;
            }

            // Mettre à jour la note sur les frais
            if (feeNoteElement) {
              feeNoteElement.textContent = formatFeeNote(feeInfo);
            }

            // Mettre à jour le texte du bouton de paiement si le mode Wallet est actif
            if (currentMethod === 'wallet') {
              const payBtn = document.getElementById('feexpay-pay-btn');
              if (payBtn) setPayButtonTotal(payBtn, totalAmount);
            }
          })
          .catch(() => {
            if (feeValueElement) feeValueElement.textContent = '';
            if (totalLabelElement) totalLabelElement.textContent = '';
            if (feeNoteElement) feeNoteElement.textContent = FEE_UNAVAILABLE_NOTE;

            if (currentMethod === 'wallet') {
              const payBtn = document.getElementById('feexpay-pay-btn');
              if (payBtn) setPayButtonFeeError(payBtn);
            }
          });
      };

      // Function to update wallet providers based on country
      const updateWalletProviders = (country) => {
        // Clear existing options
        walletProviderSelect.innerHTML = '';

        // Add new options based on selected country
        const providers = walletProviders[country] || [];
        providers.forEach(provider => {
          const option = document.createElement('option');
          option.value = provider;
          option.textContent = provider;
          walletProviderSelect.appendChild(option);
        });

        // Update country code
        if (walletCountryCode) {
          walletCountryCode.textContent = countryCodes[country] || '+229';
        }

        // Mettre à jour les informations de frais pour le premier fournisseur
        if (providers.length > 0) {
          updateWalletFeeInformation(country, providers[0]);
        }
      };

      // Initialize wallet providers for default country
      if (walletCountrySelect.value) updateWalletProviders(walletCountrySelect.value);

      // Update wallet providers when country changes
      walletCountrySelect.addEventListener('change', function() {
        updateWalletProviders(this.value);
      });

      // Update fee information when provider changes
      walletProviderSelect.addEventListener('change', function() {
        updateWalletFeeInformation(walletCountrySelect.value, this.value);
      });

      // Initialize fee information for the default country and provider
      if (walletCountrySelect.value && walletProviders[walletCountrySelect.value]?.length > 0) {
        updateWalletFeeInformation(walletCountrySelect.value, walletProviders[walletCountrySelect.value][0]);
      }

      // Method selection buttons
      const methodButtons = modalContent.querySelectorAll('.feexpay-method-btn');
      methodButtons.forEach(btn => {
        btn.addEventListener('click', function() {
          // Remove active class from all buttons
          methodButtons.forEach(b => {
            b.classList.remove('active');
          });

          // Add active class to clicked button
          this.classList.add('active');
        });
      });

      // Show the modal
      FeexPayConfig.modalElement.classList.add('active');

      // Mettre à jour les informations de la carte si nécessaire
      if (currentMethod === 'card') {
        // Attendre que toutes les fonctions soient définies
        setTimeout(() => {
          if (typeof updateCardInformation === 'function') {
            updateCardInformation();
          }
        }, 0);
      }
    },

    /**
     * Hide the payment modal
     */
    hidePaymentModal: function() {
      if (!FeexPayConfig.modalElement) return;
      FeexPayConfig.modalElement.classList.remove('active');
    },

    /**
     * Show result modal with transaction status
     */
    showResultModal: function(status, message, reference, transid) {
      // Create result modal if it doesn't exist
      if (!FeexPayConfig.resultModalElement) {
        const resultModalOverlay = document.createElement('div');
        resultModalOverlay.className = 'feexpay-modal-overlay';
        resultModalOverlay.style.position = 'fixed';
        resultModalOverlay.style.top = '0';
        resultModalOverlay.style.left = '0';
        resultModalOverlay.style.width = '100%';
        resultModalOverlay.style.height = '100%';
        resultModalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        resultModalOverlay.style.display = 'flex';
        resultModalOverlay.style.alignItems = 'center';
        resultModalOverlay.style.justifyContent = 'center';
        resultModalOverlay.style.zIndex = '9999';
        resultModalOverlay.style.opacity = '0';
        resultModalOverlay.style.visibility = 'hidden';
        resultModalOverlay.style.transition = 'opacity 0.3s, visibility 0.3s';

        const resultModal = document.createElement('div');
        resultModal.className = 'feexpay-result-modal';
        resultModal.style.backgroundColor = 'white';
        resultModal.style.borderRadius = '8px';
        resultModal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        resultModal.style.width = '90%';
        resultModal.style.maxWidth = '400px';
        resultModal.style.overflow = 'hidden';
        resultModal.style.transform = 'scale(0.9)';
        resultModal.style.transition = 'transform 0.3s';

        resultModalOverlay.appendChild(resultModal);
        document.body.appendChild(resultModalOverlay);

        FeexPayConfig.resultModalElement = resultModalOverlay;
      }

      // Get the modal content container
      const resultModal = FeexPayConfig.resultModalElement.querySelector('.feexpay-result-modal');

      // Set content based on status
      const isSuccess = status === 'SUCCESSFUL' || status === 'SUCCESS';
      const statusColor = isSuccess ? '#10b981' : '#ef4444';
      const statusIcon = isSuccess ?
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' :
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';

      const statusText = isSuccess ? 'Paiement réussi' : status === "FAILED" ? "Paiement échoué" : "Validation Erreur";
      const buttonText = isSuccess ? 'Fermer' : 'Réessayer';

      // Set the modal content
      resultModal.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <div style="color: ${statusColor}; margin-bottom: 16px;">
            ${statusIcon}
          </div>
          <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #112C56;">${statusText}</h3>
          <p style="color: #6b7280; margin-bottom: 16px;">${escapeHtml(message)}</p>
          ${reference ? `<p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">Référence: ${escapeHtml(reference)}</p>` : ''}
          <button id="feexpay-result-btn" style="padding: 8px 16px; background-color: #D45D00; color: white; font-weight: 500; border: none; border-radius: 4px; cursor: pointer;">
            ${buttonText}
          </button>
        </div>
      `;
      const phoneInput = document.querySelector('#feexpay-country-code + input[type="tel"]');
      const phone = phoneInput.value;
      // Utilisation des countryCodes définis dans showPaymentModal
      const countryCodes = {
        'Benin': '+229',
        'Togo': '+228',
        'Côte d\'Ivoire': '+225',
        'Burkina Faso': '+226',
        'Senegal': '+221',
        'Congo-Brazzaville': '+242'
      };
      // Get country code without the + sign
      const countryCodeElement = document.querySelector('#feexpay-country-code span');
      let countryCode = '';
      if (countryCodeElement) {
        countryCode = countryCodeElement.textContent.replace('+', '');
      } else {
        // Fallback to country codes if element not found

        countryCode = countryCodes[country]?.replace('+', '') || '';


      }

      // Trouver le nom du pays à partir de l'indicatif
      const countryName = Object.keys(countryCodes).find(
        name => countryCodes[name].replace('+', '') === countryCode
      ) || 'Pays inconnu';

      // Get personal information if available
      const otpInput = document.getElementById('feexpay-otp-input');

      let cleanPhone = phone.replace(/\D/g, ''); // Retire tous les caractères non numériques

      if (cleanPhone.startsWith(countryCode + countryCode)) {
        cleanPhone = cleanPhone.substring(countryCode.length); // Supprime le 1er code pays
      } else if (cleanPhone.startsWith(countryCode)) {
        // Si ça commence une seule fois, on laisse (optionnel)
        cleanPhone = cleanPhone.substring(countryCode.length);
      }

      // Ajoute le code pays une seule fois
      const formattedPhone = countryCode + cleanPhone;

      const networkSelect = document.getElementById('feexpay-network-select');
      const netwokWallet = document.getElementById('feexpay-wallet-provider-select')

      const networkDisplay = networkSelect.value;
      const networkDisplayWallet = netwokWallet.value;
      const nameInput = document.getElementById('feexpay-name-input');
      const nameDisplay = nameInput.value;

      const emailInput = document.getElementById('feexpay-email-input');
      const emailDisplay = emailInput.value;

      // Réseau réellement utilisé : celui de l'onglet Wallet uniquement si cet onglet est affiché
      function networkValue () {
        const walletSectionElement = document.getElementById('feexpay-wallet-section');
        const walletActive = walletSectionElement && walletSectionElement.style.display !== 'none';
        return walletActive ? networkDisplayWallet : networkDisplay;
      }

// console.log(networkDisplay,networkDisplayWallet);
      // Add event listener to the button
      const resultBtn = resultModal.querySelector('#feexpay-result-btn');

      if (resultBtn) {
        if (isSuccess) {
          if (FeexPayConfig.options.callback_url) {
            // Redirection automatique si callback_url est défini
            redirectToMerchantUrl(FeexPayConfig.options.callback_url, reference);

            // Fermer la modale (optionnel si redirection immédiate)
            this.hideResultModal();
          } else {
            // Pas de redirection, donc on ferme la modale au clic sur le bouton
            resultBtn.addEventListener('click', () => {
              this.hideResultModal();
            });
          }


          // Exécuter le callback s’il n’a pas encore été fait
          if (typeof FeexPayConfig.options.callback === 'function' && !FeexPayConfig.callbackCalled) {
            FeexPayConfig.options.callback({
              reference: reference || null,
              status: 'SUCCESSFUL',
              country:countryName,
              phoneNumber: formattedPhone,
              full_name: nameDisplay || '',
              email : emailDisplay,
              reseau: networkValue(),
              callback_info: FeexPayConfig.options.callback_info,
              description: FeexPayConfig.options.description,
              transaction_id: transid || reference,
              message: message
            });

            FeexPayConfig.callbackCalled = true;
          }
        } else {
          // Paiement échoué : on attend le clic sur le bouton "Réessayer"
          resultBtn.addEventListener('click', () => {
            this.hideResultModal();

            const payBtn = document.getElementById('feexpay-pay-btn');
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }

            if (status === 'FAILED' && FeexPayConfig.options.error_callback_url) {
              redirectToMerchantUrl(FeexPayConfig.options.error_callback_url, reference);
            }
          });
        }
      }



      // Automatically call callback for success or failure without waiting for button click
      if (typeof FeexPayConfig.options.callback === 'function' && !FeexPayConfig.callbackCalled) {
        FeexPayConfig.options.callback({
          reference : reference || null,
          status: status,
          country:countryName,
          phoneNumber : formattedPhone,
          full_name : nameDisplay || '',
          email : emailDisplay || '',
          reseau : networkValue(),
          callback_info : FeexPayConfig.options.callback_info,
          description: FeexPayConfig.options.description,
          transaction_id : transid || reference,
          message: message

        });

        FeexPayConfig.callbackCalled = true;


      }



      // Reset the payment button if it exists
      const payBtn = document.getElementById('feexpay-pay-btn');
      if (payBtn) {
        payBtn.textContent = 'Payer';
        payBtn.disabled = false;
      }

      // Show the modal
      FeexPayConfig.resultModalElement.style.opacity = '1';
      FeexPayConfig.resultModalElement.style.visibility = 'visible';
      resultModal.style.transform = 'scale(1)';
    },


    /**
     * Hide the result modal
     */
    hideResultModal: function() {
      if (!FeexPayConfig.resultModalElement) return;

      const resultModal = FeexPayConfig.resultModalElement.querySelector('.feexpay-result-modal');

      // Animate out
      FeexPayConfig.resultModalElement.style.opacity = '0';
      FeexPayConfig.resultModalElement.style.visibility = 'hidden';
      if (resultModal) {
        resultModal.style.transform = 'scale(0.9)';
      }
    },

    /**
     * Handle cleanup after a failed payment attempt (removes iframe if present)
     */
    handlePaymentFailureCleanup: function() {
      if (FeexPayConfig.modalElement) { // Ensure modalElement exists
        const modalContent = FeexPayConfig.modalElement.querySelector('.feexpay-modal');
        if (modalContent) {
          const iframe = modalContent.querySelector('iframe');
          if (iframe && iframe.parentNode === modalContent) {
            modalContent.removeChild(iframe);
          }
        }
      }
    },



    /**
     * Process the payment
     */

    processPayment: async function() {
      // Get selected country and network
      const countrySelect = document.getElementById('feexpay-country-select');
      const networkSelect = document.getElementById('feexpay-network-select');
      const phoneInput = document.querySelector('#feexpay-country-code + input[type="tel"]');

      if (!countrySelect || !networkSelect || !phoneInput) {
        // console.error('FeexPay: Required form elements not found');
        return;
      }

      const country = countrySelect.value;
      const networkDisplay = networkSelect.value;
      const phone = phoneInput.value.trim();

      // Validate phone number
      if (!phone) {
        this.showResultModal('REQUIRED', 'Veuillez entrer un numéro de téléphone valide', '');
        return;
      }

      // Get the pay button reference first
      const payBtn = document.getElementById('feexpay-pay-btn');

      // Validate personal information fields if they are visible
      const personalInfoSection = document.getElementById('feexpay-personal-info');
      const nameInput = document.getElementById('feexpay-name-input');
      const emailInput = document.getElementById('feexpay-email-input');

      // Check if personal info section is visible and not hidden by fields_to_hide option
      if (personalInfoSection && personalInfoSection.style.display !== 'none') {

        // Check if name field is visible and empty
        if (nameInput && nameInput.style.display !== 'none' && !nameInput.value.trim()) {
          this.showResultModal('REQUIRED', 'VeuilFlez entrer votre nom et prénoms', '');
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }
          return;
        }

        // Check if email field is visible and empty
        if (emailInput && emailInput.style.display !== 'none' && !emailInput.value.trim()) {
          this.showResultModal('REQUIRED', 'Veuillez entrer votre adresse email', '');
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }
          return;
        }
      }

      // Show loading state
      if (payBtn) {
        payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
        payBtn.disabled = true;
      }

      // Get API network identifier
      const networkApiId = networkApiIds[country]?.[networkDisplay];
      if (!networkApiId) {
        // console.error(`FeexPay: Network API identifier not found for ${networkDisplay} in ${country}`);
        return;
      }

      // Get country code without the + sign
      const countryCodeElement = document.querySelector('#feexpay-country-code span');
      let countryCode = '';
      if (countryCodeElement) {
        countryCode = countryCodeElement.textContent.replace('+', '');
      } else {
        // Fallback to country codes if element not found
        // Utilisation des countryCodes définis dans showPaymentModal
        const countryCodes = {
          'Benin': '+229',
          'Togo': '+228',
          'Côte d\'Ivoire': '+225',
          'Burkina Faso': '+226',
          'Senegal': '+221',
          'Congo-Brazzaville': '+242',
          'Ghana': '+233'
        };
        countryCode = countryCodes[country]?.replace('+', '') || '';
      }

      // Get personal information if available
      const otpInput = document.getElementById('feexpay-otp-input');
      const fullName = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const otp = otpInput ? otpInput.value.trim() : '';

      let cleanPhone = phone.replace(/\D/g, ''); // Retire tous les caractères non numériques

      if (cleanPhone.startsWith(countryCode + countryCode)) {
        cleanPhone = cleanPhone.substring(countryCode.length); // Supprime le 1er code pays
      } else if (cleanPhone.startsWith(countryCode)) {
        // Si ça commence une seule fois, on laisse (optionnel)
        cleanPhone = cleanPhone.substring(countryCode.length);
      }

      // Ajoute le code pays une seule fois
      const formattedPhone = countryCode + cleanPhone;

      let description = FeexPayConfig.options.description
      if (networkDisplay.toUpperCase() === 'MTN') {
        description = description.replace(/[^a-zA-Z0-9 ]/g, '');
      }
      // Prepare payment data with country code prefix for phone number
      const paymentData = {
        phoneNumber: formattedPhone,
        country: countryCode,
        amount: FeexPayConfig.options.amount,
        reseau: networkApiId.toUpperCase(),
        shop: FeexPayConfig.options.id,

        first_name: fullName || '',
        email: email || '',
        custom_id : FeexPayConfig.options.custom_id,
        otp: otp, // Utilise le code OTP pour ORANGE au Sénégal
        callback_info: FeexPayConfig.options.callback_info,
        description: description,
        currency: FeexPayConfig.options.currency,
        merchant_domain :  window.location.origin,
        payment_interface : "JAVASCRIPT"
        // Additional fields for CORIS payments
      };

      // console.log(paymentData);


      // Check if this is a CORIS payment
      if (networkDisplay === 'CORIS') {
        // Process CORIS payment directly
        this.submitPayment('coris', paymentData);
        return;
      }


      // Check if network requires OTP (other than CORIS which is handled separately)
      const requiresOtp = networksRequiringOtp.includes(networkDisplay) &&
        networkDisplay !== 'CORIS';

      if (requiresOtp) {
        // Pour les autres réseaux nécessitant un OTP, afficher le champ OTP standard
        const modalContent = FeexPayConfig.modalElement.querySelector('.feexpay-modal');
        const paymentSection = modalContent.querySelector('#feexpay-payment-section');

        if (paymentSection) {
          // Create OTP section
          const otpSection = document.createElement('div');
          otpSection.id = 'feexpay-otp-section';
          otpSection.style.marginBottom = '24px';

          otpSection.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background-color: #e5e7eb; color: #4b5563; font-weight: bold; font-size: 12px; margin-right: 8px;">
            3
          </div>
          <h3 style="font-weight: bold; color: #112C56;">Code OTP</h3>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <input type="text" id="feexpay-dynamic-otp-input" placeholder="Entrez le code OTP reçu" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none;">
          <p style="font-size: 12px; color: #6b7280;">Un code OTP a été envoyé à votre téléphone. Veuillez l'entrer ci-dessus pour compléter la transaction.</p>
        </div>
      `;

          // Insert before the payment summary
          const paymentSummary = modalContent.querySelector('#feexpay-payment-summary');
          if (paymentSummary) {
            paymentSummary.parentNode.insertBefore(otpSection, paymentSummary);
          }

          // Update pay button to submit OTP
          if (payBtn) {
            payBtn.textContent = 'Valider OTP';
            payBtn.disabled = false;
            payBtn.onclick = function() {
              const otpInput = document.getElementById('feexpay-dynamic-otp-input');
              if (!otpInput || !otpInput.value.trim()) {
                this.showResultModal('REQUIRED', 'Veuillez entrer le code OTP', '');
                return;
              }

              // Add OTP to payment data
              paymentData.otp = otpInput.value.trim();

              // Process payment with OTP
              FeexPayButton.submitPayment(networkApiId, paymentData);
            };
          }
        }
      } else {
        // For networks not requiring OTP, process payment directly
        FeexPayButton.submitPayment(networkApiId, paymentData);
      }
    },
    /**
     * Submit payment to API
     * @param networkApiId - API identifier for the network
     * @param paymentData - Payment data to submit
     */

    submitPayment: function(networkApiId, paymentData) {
      const payBtn = document.getElementById('feexpay-pay-btn');
      if (payBtn) {
        payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
        payBtn.disabled = true;
      }

      // Special handling for CORIS in Benin
      // console.log('Network API ID:', networkApiId, 'Network Display:', paymentData.reseau);
      if (networkApiId === 'coris' || paymentData.reseau === 'CORIS') {
        // console.log('Processing CORIS payment');
        this.processCorisPayment(paymentData);
        return;
      }

      // Special handling for DJAMO in Côte d'Ivoire
      if (networkApiId === 'djamo_ci' || paymentData.reseau === 'DJAMO') {
        this.processDjamoCIPayment(paymentData);
        return;
      }

      // Special handling for WAVE in Côte d'Ivoire
      if (networkApiId === 'wave_ci' || paymentData.reseau === 'WAVE') {
        // console.log('Processing WAVE CI payment');
        this.processWaveCIPayment(paymentData);
        return;
      }

      // Make API request to process payment

      if(FeexPayConfig.options.mode === "LIVE" && FeexPayConfig.options.token.startsWith("fp_")) {
        fetch(`${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FeexPayConfig.options.token}`
          },
          body: JSON.stringify(paymentData)
        })
          .then(response => response.json())
          .then(data => {

            if(data?.message === "Network Unavailable"){
              this.handlePaymentFailureCleanup();
              this.showResultModal(
                'FAILED',
                'Le réseau est indisponible. Veuillez réessayer plus tard ! ',

              );
            }


            if ((paymentData.reseau === "USSD" && data?.url) || (paymentData.reseau === "ENAIRA" && data?.payment_url) || (paymentData.reseau === "BANK" && data?.url) || (paymentData.reseau === "BANK TRANSFER" && data?.url)) {
              const iframeContainer = document.createElement('div');
              iframeContainer.style.position = 'fixed';
              iframeContainer.style.top = '0';
              iframeContainer.style.left = '0';
              iframeContainer.style.width = '100vw';
              iframeContainer.style.height = '100vh';
              iframeContainer.style.zIndex = '100000';
              iframeContainer.style.backgroundColor = '#fff';
              iframeContainer.style.margin = '0';
              iframeContainer.style.padding = '0';
              iframeContainer.style.overflow = 'hidden';

              const iframe = document.createElement('iframe');
              iframe.src = safePaymentUrl(data?.url || data?.payment_url);
              iframe.referrerPolicy = 'no-referrer';
              iframe.width = '100%';
              iframe.height = '100%';
              iframe.frameBorder = '0';
              iframe.style.border = 'none';
              iframe.style.overflow = 'hidden';
              iframe.style.display = 'block';

              iframeContainer.appendChild(iframe);
              document.body.appendChild(iframeContainer);

            }


            const networksWithPaymentLink = ["ORANGE BF", "WAVE CI", "ORANGE CI", "ORANGE SN", "WAVE SN"];
            if (networksWithPaymentLink.includes(paymentData.reseau) && data?.payment_url) {
              window.location.assign(safePaymentUrl(data.payment_url));
            }



            if (data?.statusCode === "37") {
              this.handlePaymentFailureCleanup();
              this.showResultModal(
                'FAILED',
                'Le paiement a été rejeté par l\'opérateur. Veuillez augmenter le montant et réessayer.'
              );
            }

            if (data?.statusCode === "555") {
              this.handlePaymentFailureCleanup();
              this.showResultModal(
                'FAILED',
                'Veuillez vérifier votre numéro de téléphone Moov et réessayer !'
              );
            }
            // Check if we have a reference to poll
            if ((data.reference  && data.responsemsg !== "UNKNOWN MOBILE NUMBER") || (data.order_id && data.responsemsg !== "UNKNOWN MOBILE NUMBER") || (data.status === 'PENDING' && data.responsemsg !== "UNKNOWN MOBILE NUMBER") || (data.status===202 && data.responsemsg !== "UNKNOWN MOBILE NUMBER")) {
              // Update button to show polling status
              if (payBtn) {
                payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
              }

              let reference = data.reference;


              // Start polling for transaction status
              this.pollTransactionStatus(reference, payBtn, paymentData);
            }
            else if (data.status === 'SUCCESSFUL' || data.status === 'SUCCESS') {
              // Transaction already successful
              this.handleSuccessfulTransaction(data);
            }

            else if (data.responsemsg === "UNKNOWN MOBILE NUMBER") {
              this.handlePaymentFailureCleanup();
              this.showResultModal(
                'FAILED',
                'Le numéro de téléphone est invalide. Veuillez réessayer ! ',

              );
            }

            else if (data.statusCode === "92") {
              this.handlePaymentFailureCleanup();
              this.showResultModal(
                'FAILED',
                'Votre session USSD a expiré ou la transaction a été annulé. Veuillez réessayer ! ',

              );
            }

            else if (data.statusCode === "10") {
              this.handlePaymentFailureCleanup();
              this.showResultModal(
                'FAILED',
                'Votre solde est insuffisant pour effectuer cette opération.',

              );
            }


            else {
              // Show error in result modal
              this.handlePaymentFailureCleanup();
              this.showResultModal(
                'FAILED',
                getApiErrorMessage(data, undefined, 'Une erreur est survenue lors du traitement du paiement'),
                data.reference || ''
              );
            }
          })
          .catch(error => {
            // console.error('FeexPay: Payment processing error', error);

            // Show error in result modal
            this.handlePaymentFailureCleanup();
            this.showResultModal(
              'FAILED',
              'Une erreur est survenue lors du traitement du paiement',
              ''
            );
          });

      }

      else if (FeexPayConfig.options.mode === "LIVE" && !FeexPayConfig.options.token.startsWith('fp_')){
        this.showResultModal('FAILED','Le token est invalide')
      }

      else if (FeexPayConfig.options.mode === "SANDBOX" && FeexPayConfig.options.token.startsWith('fp_')){
        this.showResultModal('FAILED','Veillez passer en mode LIVE')
      }

      else{
        this.showResultModal(
          'SUCCESS',
          'Paiement reussi',
          'ref_162672_363738_yEGZHZHzh',
          'ref_162672_363738_yEGZHZHzh'
        );
      }



    },




    pollTransactionStatus: function(reference, payBtn, paymentData) {
      let pollCount = 0;
      const maxPolls = 18; // 4,75 minutes

      const pollInterval = setInterval(() => {
        pollCount++;

        fetch(`${FeexPayConfig.baseUrl}/api/transactions/public/single/status/${reference}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${FeexPayConfig.options.token}`
          }
        })
          .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
          })
          .then(data => {
            const status = data.status;
            const reason = data.reason;

            // ✅ Cas succès
            if (status === 'SUCCESSFUL' || status === 'SUCCESS') {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              FeexPayButton.showResultModal('SUCCESSFUL', 'Votre paiement a été traité avec succès.', data.reference);
              return;
            }

            // ❌ Cas échecs explicites
            if (reason === "LOW_BALANCE_OR_PAYEE_LIMIT_REACHED_OR_NOT_ALLOWED") {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              FeexPayButton.handlePaymentFailureCleanup();
              FeexPayButton.showResultModal('FAILED', 'Votre solde est insuffisant pour effectuer cette opération.', reference);
              return;
            }


            // ❌ Cas échecs explicites
            if (reason === "LOW_BALANCE_OR_PAYEE_LIMIT_REACHED_OR_NOT_ALLOWED") {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              FeexPayButton.handlePaymentFailureCleanup();
              FeexPayButton.showResultModal('FAILED', 'Votre solde est insuffisant pour effectuer cette opération.', reference);
              return;
            }

            // ❌ Cas échecs explicites
            if (status ===500) {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              FeexPayButton.handlePaymentFailureCleanup();
              FeexPayButton.showResultModal('FAILED', 'Une erreur technique est survenue lors de la vérification du paiement. Veuillez réessayer plus tard.', reference);
              return;
            }



            if (reason === "PAYER_NOT_FOUND" || reason === "PAYER NOT FOUND") {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              FeexPayButton.handlePaymentFailureCleanup();
              FeexPayButton.showResultModal('FAILED', 'Veuillez bien vérifier le numéro de téléphone et le réseau sélectionné', reference);
              return;
            }

            const statusSoap = data?.response_operator?.["soapenv:Envelope"]?.["soapenv:Body"]?.[0]
              ?.["api:getTransactionStatusImmediateResponse"]?.[0]
              ?.response?.[0]?.status?.[0];

            if (status === 'FAILED' && statusSoap === "95") {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              FeexPayButton.handlePaymentFailureCleanup();
              FeexPayButton.showResultModal('FAILED', 'La transaction a echoué,veuillez réessayer !', reference);
              return;
            }

            if (status === 'FAILED' || status === 'CANCELLED') {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              FeexPayButton.handlePaymentFailureCleanup();
              FeexPayButton.showResultModal('FAILED', 'Le paiement a échoué ou a été annulé.', reference);
              return;
            }

            // ⏳ Si rien de concluant et on dépasse le délai
            if (pollCount >= maxPolls) {
              clearInterval(pollInterval);
              FeexPayButton.handlePaymentFailureCleanup();
              FeexPayButton.showResultModal(
                'FAILED',
                "Nous n’avons pas pu confirmer automatiquement votre paiement. Si vous avez été débité, veuillez contacter votre marchand ou le support FeexPay.",
                reference
              );
              return;
            }

            // Affichage loading
            if (payBtn) {
              payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
            }
          })
          .catch(error => {
            console.warn("Erreur temporaire lors du polling : ", error.message);
            // ✅ Stopper le polling si c'est une erreur serveur ou critique
            if (
              error.message.includes('500') ||
              error.message.includes('502') ||
              error.message.includes('503') ||
              error.message.includes('504') ||
              error.message.includes('NetworkError') ||
              error.message.includes('Failed to fetch')
            ) {
              clearInterval(pollInterval);

              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              FeexPayButton.handlePaymentFailureCleanup();

              FeexPayButton.showResultModal(
                'FAILED',
                "Une erreur technique est survenue lors de la vérification du paiement. Veuillez réessayer plus tard.",
                reference
              );

              return;
            }

            // Sinon, continuer le polling (par exemple, pour des erreurs temporaires mineures)
            if (payBtn) {
              payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
            }
          });


      }, 15000); // 15 secondes
    }
    ,

    /**
     * Handle successful transaction
     */
    handleSuccessfulTransaction: function(data) {
      // Hide payment modal
      this.hidePaymentModal();

      // Show result modal with success message
      this.showResultModal(
        'SUCCESSFUL',
        'Votre paiement a été traité avec succès.',
        data.reference || data.transaction_id || data.orderId,
        ''
      );
    },

    /**
     * Crée (une seule fois) la modale OTP partagée par CORIS et B-MO
     */
    ensureOtpModalElement: function() {
      if (!FeexPayConfig.otpModalElement) {
        const otpModalOverlay = document.createElement('div');
        otpModalOverlay.className = 'feexpay-otp-modal-overlay';
        otpModalOverlay.style.position = 'fixed';
        otpModalOverlay.style.top = '0';
        otpModalOverlay.style.left = '0';
        otpModalOverlay.style.width = '100%';
        otpModalOverlay.style.height = '100%';
        otpModalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        otpModalOverlay.style.display = 'flex';
        otpModalOverlay.style.alignItems = 'center';
        otpModalOverlay.style.justifyContent = 'center';
        otpModalOverlay.style.zIndex = '9999';
        otpModalOverlay.style.opacity = '0';
        otpModalOverlay.style.visibility = 'hidden';
        otpModalOverlay.style.transition = 'opacity 0.3s, visibility 0.3s';

        const otpModal = document.createElement('div');
        otpModal.className = 'feexpay-otp-modal';
        otpModal.style.backgroundColor = 'white';
        otpModal.style.borderRadius = '8px';
        otpModal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        otpModal.style.width = '90%';
        otpModal.style.maxWidth = '400px';
        otpModal.style.overflow = 'hidden';
        otpModal.style.transform = 'scale(0.9)';
        otpModal.style.transition = 'transform 0.3s';

        otpModalOverlay.appendChild(otpModal);
        document.body.appendChild(otpModalOverlay);

        FeexPayConfig.otpModalElement = otpModalOverlay;
      }
    },

    /**
     * B-MO (Bénin) — étape 1 : initie la demande. Aucun débit n'a lieu à ce stade :
     * B-MO envoie un code de confirmation par SMS au payeur, saisi ensuite dans
     * showBmoOtpModal (confirm) ou abandonné (cancel).
     */
    processBmoPayment: function(paymentData, fullName) {
      const payBtn = document.getElementById('feexpay-pay-btn');
      const resetPayBtn = () => {
        if (payBtn) {
          payBtn.textContent = 'Payer';
          payBtn.disabled = false;
        }
      };

      const amount = Number(paymentData.amount);
      if (!Number.isInteger(amount) || amount < BMO_MIN_AMOUNT || amount > BMO_MAX_AMOUNT) {
        resetPayBtn();
        this.showResultModal('FAILED', `Montant invalide : un paiement B-MO doit être compris entre ${BMO_MIN_AMOUNT.toLocaleString('fr-FR')} et ${BMO_MAX_AMOUNT.toLocaleString('fr-FR')} ${FeexPayConfig.options.currency || 'XOF'}.`, '');
        return;
      }

      const token = FeexPayConfig.options.token;
      if (FeexPayConfig.options.mode !== 'LIVE') {
        resetPayBtn();
        this.showResultModal('FAILED', "Le paiement B-MO n'est disponible qu'en mode LIVE.", '');
        return;
      }
      if (typeof token !== 'string' || !token.startsWith('fp_')) {
        resetPayBtn();
        this.showResultModal('FAILED', 'Le token est invalide', '');
        return;
      }

      // B-MO exige nom et prénom séparés pour un payeur qui n'est pas encore client B-MO
      const nameParts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
      const body = {
        phoneNumber: paymentData.phoneNumber,
        amount: paymentData.amount,
        shop: paymentData.shop,
      };
      if (paymentData.description) body.description = String(paymentData.description).slice(0, 40);
      if (paymentData.email) body.email = paymentData.email;
      if (nameParts.length > 0) body.first_name = nameParts[0];
      if (nameParts.length > 1) body.last_name = nameParts.slice(1).join(' ');
      if (paymentData.callback_info != null && paymentData.callback_info !== '') body.callback_info = paymentData.callback_info;

      this.bmoRequest('', body)
        .then(({ ok, status, data }) => {
          if (ok && data.status === 'PENDING' && data.reference) {
            this.showBmoOtpModal(data.reference, paymentData);
            return;
          }
          resetPayBtn();
          if (ok && (data.status === 'SUCCESSFUL' || data.status === 'SUCCESS')) {
            this.showResultModal('SUCCESSFUL', 'Votre paiement a été traité avec succès.', data.reference);
            return;
          }
          const message = ok
            ? bmoFailureMessage(data.reason)
            : getApiErrorMessage(data, status, 'Une erreur est survenue lors du traitement du paiement B-MO');
          this.showResultModal('FAILED', message, data.reference || '');
        })
        .catch(() => {
          resetPayBtn();
          this.showResultModal('FAILED', 'Une erreur est survenue lors du traitement du paiement B-MO', '');
        });
    },

    /**
     * Appel aux endpoints B-MO de l'API (initiation, /confirm, /cancel)
     */
    bmoRequest: function(path, payload) {
      return fetch(`${FeexPayConfig.baseUrl}/api/transactions/public/requesttopay/bmo${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FeexPayConfig.options.token}`
        },
        body: JSON.stringify(payload)
      }).then(response => response.json()
        .catch(() => ({}))
        .then(data => ({ ok: response.ok, status: response.status, data: data || {} })));
    },

    /**
     * B-MO — étape 2 : saisie du code de confirmation reçu par SMS.
     * Un code invalide ou expiré laisse la transaction en attente : le payeur peut
     * réessayer tant qu'il n'a pas annulé.
     */
    showBmoOtpModal: function(reference, paymentData) {
      this.ensureOtpModalElement();
      const otpModal = FeexPayConfig.otpModalElement.querySelector('.feexpay-otp-modal');
      const payBtn = document.getElementById('feexpay-pay-btn');

      otpModal.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #112C56;">Confirmez votre paiement B-MO</h3>
          <p style="color: #6b7280; margin-bottom: 16px;">Un code de confirmation a été envoyé par SMS au +${escapeHtml(paymentData.phoneNumber)}. Saisissez-le ci-dessous pour valider le paiement.</p>
          <div style="margin-bottom: 16px;">
            <input type="text" id="feexpay-bmo-otp-input" inputmode="numeric" autocomplete="one-time-code" placeholder="Code de confirmation" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none; text-align: center; font-size: 18px; letter-spacing: 2px; box-sizing: border-box;">
          </div>
          <div id="feexpay-bmo-otp-message" style="color: #ef4444; margin-bottom: 16px; font-size: 14px; min-height: 20px;"></div>
          <div style="display: flex; justify-content: space-between;">
            <button id="feexpay-bmo-otp-cancel" style="padding: 8px 16px; background-color: #f3f4f6; color: #4b5563; font-weight: 500; border: none; border-radius: 4px; cursor: pointer;">
              Annuler
            </button>
            <button id="feexpay-bmo-otp-submit" style="padding: 8px 16px; background-color: #D45D00; color: white; font-weight: 500; border: none; border-radius: 4px; cursor: pointer;">
              Valider
            </button>
          </div>
        </div>
      `;

      const otpInput = otpModal.querySelector('#feexpay-bmo-otp-input');
      const otpMessage = otpModal.querySelector('#feexpay-bmo-otp-message');
      const submitBtn = otpModal.querySelector('#feexpay-bmo-otp-submit');
      const cancelBtn = otpModal.querySelector('#feexpay-bmo-otp-cancel');

      const setBusy = (busy) => {
        submitBtn.disabled = busy;
        cancelBtn.disabled = busy;
        submitBtn.innerHTML = busy ? '<span class="feexpay-loading-spinner"></span> ' : 'Valider';
      };
      const resetPayBtn = () => {
        if (payBtn) {
          payBtn.textContent = 'Payer';
          payBtn.disabled = false;
        }
      };
      // Résultat incertain (erreur serveur/réseau) : on interroge le statut réel
      // plutôt que de conclure à un échec alors que le débit a pu avoir lieu.
      const checkStatus = () => {
        this.hideOtpModal();
        if (payBtn) payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> Vérification du paiement ...';
        this.pollTransactionStatus(reference, payBtn, paymentData);
      };

      submitBtn.addEventListener('click', () => {
        const otp = otpInput.value.trim();
        if (!/^\d+$/.test(otp)) {
          otpMessage.textContent = 'Veuillez entrer le code reçu par SMS';
          return;
        }
        otpMessage.textContent = '';
        setBusy(true);

        this.bmoRequest('/confirm', { reference, otp })
          .then(({ ok, status, data }) => {
            if (ok) {
              if (data.status === 'SUCCESSFUL' || data.status === 'SUCCESS') {
                this.hideOtpModal();
                resetPayBtn();
                this.showResultModal('SUCCESSFUL', 'Votre paiement a été traité avec succès.', reference);
              } else if (data.status === 'FAILED') {
                this.hideOtpModal();
                resetPayBtn();
                this.showResultModal('FAILED', bmoFailureMessage(data.reason), reference);
              } else {
                checkStatus();
              }
              return;
            }
            if (data.code === 'INVALID_CONFIRMATION_CODE' || data.code === 'INVALID_OTP') {
              setBusy(false);
              otpInput.value = '';
              otpInput.focus();
              otpMessage.textContent = getApiErrorMessage(data, status);
              return;
            }
            if (data.code === 'ALREADY_FINALIZED' || status >= 500) {
              checkStatus();
              return;
            }
            this.hideOtpModal();
            resetPayBtn();
            this.showResultModal('FAILED', getApiErrorMessage(data, status, 'Une erreur est survenue lors de la validation du code'), reference);
          })
          .catch(() => checkStatus());
      });

      cancelBtn.addEventListener('click', () => {
        setBusy(true);
        this.bmoRequest('/cancel', { reference })
          .then(({ ok, data }) => {
            this.hideOtpModal();
            resetPayBtn();
            // Le payeur a pu confirmer depuis son téléphone entre-temps
            if (ok && (data.status === 'SUCCESSFUL' || data.status === 'SUCCESS')) {
              this.showResultModal('SUCCESSFUL', 'Votre paiement a été traité avec succès.', reference);
            } else {
              this.showResultModal('FAILED', "Paiement annulé par l'utilisateur", reference);
            }
          })
          .catch(() => checkStatus());
      });

      otpInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !submitBtn.disabled) submitBtn.click();
      });

      FeexPayConfig.otpModalElement.style.opacity = '1';
      FeexPayConfig.otpModalElement.style.visibility = 'visible';
      otpModal.style.transform = 'scale(1)';
      setTimeout(() => otpInput.focus(), 300);
    },

    /**
     * Process CORIS payment with OTP verification
     */
    processCorisPayment: async function(paymentData) {
      // console.log('CORIS payment data:', paymentData);

      // Get the pay button reference
      const payBtn = document.getElementById('feexpay-pay-btn');

      // Format the phone number correctly
      const walletPhoneInput = document.getElementById('feexpay-wallet-phone-input');
      const phone = walletPhoneInput?.value.trim();

      if (!phone) {
        this.showResultModal('REQUIRED', 'Veuillez entrer votre numéro de téléphone', '');
        if (payBtn) {
          payBtn.textContent = 'Payer';
          payBtn.disabled = false;
        }
        return;
      }

      // Format the phone number according to the required format
      let country = '';


      // Déterminer le code pays en fonction du pays sélectionné
      const walletCountrySelect = document.getElementById('feexpay-wallet-country-select');
      if (walletCountrySelect?.value === 'Benin') {
        country = '229';
      } else {
        // Par défaut, utiliser le code du Bénin
        country = '229';
      }

      // Formater le numéro de téléphone
      // Enlever tous les caractères non numériques
      let cleanPhone = phone.replace(/\D/g, '');

      // Si le numéro commence par le code pays, l'enlever
      if (cleanPhone.startsWith(country)) {
        cleanPhone = cleanPhone.substring(country.length);
      }

      // Si le numéro commence par un 0, l'enlever
      // if (cleanPhone.startsWith('0')) {
      //   cleanPhone = cleanPhone.substring(1);
      // }

      // Formater le numéro de téléphone pour la partie droite


      // Numéro de téléphone complet avec code pays
      const phoneNumber = country + cleanPhone;
      // Préparer les données de paiement selon le format requis
      const formattedPaymentData = {
        phoneNumber: phoneNumber,
        country: country,

        amount: paymentData.amount.toString(),
        currency: FeexPayConfig.options.currency,
        description: FeexPayConfig.options.description || 'Paiement FeexPay',
        reseau: 'CORIS',
        shop: FeexPayConfig.options.id,
        token: FeexPayConfig.options.token,
        otp: '', // OTP vide pour la première requête
        reference: '',
        merchant_domain : window.location.origin,
        payment_interface : "JAVASCRIPT"
      };

      // Ajouter email et first_name seulement s'ils sont disponibles
      if (paymentData.email) {
        formattedPaymentData.email = paymentData.email;
      }

      if (paymentData.first_name) {
        formattedPaymentData.first_name = paymentData.first_name;
      }

      // Make initial request to get OTP
      // console.log('Sending CORIS payment request to:', `${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`);
      // console.log('With payload:', JSON.stringify(formattedPaymentData, null, 2));

      // Show loading state
      if (payBtn) {
        payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
        payBtn.disabled = true;
      }

      if(FeexPayConfig.options.mode === "LIVE" && FeexPayConfig.options.token.startsWith("fp_")){
        fetch(`${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${formattedPaymentData.token}`
          },
          body: JSON.stringify(formattedPaymentData)
        })
          .then(response => {
            // console.log('CORIS response status:', response.status);
            return response.json().then(data => {
              return { status: response.status, data };
            });
          })
          .then(({ status, data }) => {
            // console.log('CORIS response data:', data);

            // Store reference if available
            if (data.reference) {
              formattedPaymentData.reference = data.reference;
            }

            // Check if OTP is required (status 201)
            if (status === 201) {
              // console.log('OTP required, showing OTP modal');
              // Show OTP input modal
              this.showOtpModal(formattedPaymentData, data);
            } else if (status === 200 || data.status === 'SUCCESSFUL' || data.status === 'SUCCESS') {
              // Payment successful without OTP
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              this.showResultModal(
                'SUCCESSFUL',
                data.message || 'Votre paiement a été traité avec succès.',
                data.reference || ''
              );
            } else {
              // Error response
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              this.showResultModal(
                'FAILED',
                getApiErrorMessage(data, status, 'Une erreur est survenue lors du traitement du paiement CORIS'),
                data.reference || ''
              );
            }
          })
          .catch(error => {
            // console.error('FeexPay: CORIS payment processing error', error);

            // Reset button state
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }

            // Show error in result modal
            this.showResultModal(
              'FAILED',
              'Une erreur est survenue lors du traitement du paiement CORIS',
              ''
            );
          });
      }

      else if (FeexPayConfig.options.mode === "LIVE" && !FeexPayConfig.options.token.startsWith('fp_')){
        this.showResultModal('FAILED','Le token est invalide')
      }

      else if (FeexPayConfig.options.mode === "SANDBOX" && FeexPayConfig.options.token.startsWith('fp_')){
        this.showResultModal('FAILED','Veillez passer en mode LIVE')
      }
      else{
        this.showResultModal(
          'SUCCESS',
          'Paiement reussi',
          'ref_162672_363738_yEGZHZHzh',
          'ref_162672_363738_yEGZHZHzh'
        );
      }

    },

    /**
     * Show OTP input modal for CORIS payments
     * @param {Object} paymentData - Payment data for CORIS
     * @param {Object} initialResponse - Initial response from the API
     */
    showOtpModal: function(paymentData, initialResponse) {
      this.ensureOtpModalElement();

      // Get the modal content container
      const otpModal = FeexPayConfig.otpModalElement.querySelector('.feexpay-otp-modal');

      // Set the modal content
      otpModal.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <div style="color: #D45D00; margin-bottom: 16px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #112C56;">Code OTP requis</h3>
          <p style="color: #6b7280; margin-bottom: 16px;">Un code OTP a été envoyé à votre numéro de téléphone. Veuillez l'entrer ci-dessous pour compléter la transaction.</p>
          
          <div style="margin-bottom: 16px;">
            <input type="text" id="feexpay-otp-input" placeholder="Entrez le code OTP" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; outline: none; text-align: center; font-size: 18px; letter-spacing: 2px;">
          </div>
          
          <div id="feexpay-otp-message" style="color: #ef4444; margin-bottom: 16px; font-size: 14px; min-height: 20px;"></div>
          
          <div style="display: flex; justify-content: space-between;">
            <button id="feexpay-otp-cancel" style="padding: 8px 16px; background-color: #f3f4f6; color: #4b5563; font-weight: 500; border: none; border-radius: 4px; cursor: pointer;">
              Annuler
            </button>
            <button id="feexpay-otp-submit" style="padding: 8px 16px; background-color: #D45D00; color: white; font-weight: 500; border: none; border-radius: 4px; cursor: pointer;">
              Valider
            </button>
          </div>
        </div>
      `;

      // Add event listeners
      const cancelBtn = otpModal.querySelector('#feexpay-otp-cancel');
      const submitBtn = otpModal.querySelector('#feexpay-otp-submit');
      const otpInput = otpModal.querySelector('#feexpay-otp-input');
      const otpMessage = otpModal.querySelector('#feexpay-otp-message');

      // Store initialResponse in FeexPayConfig for later use
      FeexPayConfig.initialCorisResponse = initialResponse;

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.hideOtpModal();

          // Reset the payment button
          const payBtn = document.getElementById('feexpay-pay-btn');
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }

          this.showResultModal('FAILED', 'Paiement annulé par l\'utilisateur', '');
        });
      }

      if (submitBtn && otpInput) {
        submitBtn.addEventListener('click', () => {
          const otpValue = otpInput.value.trim();

          if (!otpValue) {
            if (otpMessage) otpMessage.textContent = 'Veuillez entrer le code OTP';
            return;
          }

          // Update button state
          submitBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
          submitBtn.disabled = true;

          // Add OTP to payment data
          const otpPaymentData = {...paymentData};
          otpPaymentData.otp = otpValue;

          // Submit payment with OTP
          // console.log('Submitting OTP payment with data:', otpPaymentData);

          fetch(`${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${otpPaymentData.token}`
            },
            body: JSON.stringify(otpPaymentData)
          })
            .then(response => response.json().then(data => ({ status: response.status, data })))
            .then(({ status, data }) => {
              // console.log('OTP submission response data:', data);

              // Hide OTP modal
              this.hideOtpModal();

              // Reset the payment button
              const payBtn = document.getElementById('feexpay-pay-btn');
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              if ( data.status === 'SUCCESSFUL' || data.status === 'SUCCESS' ||

                (data.message && data.message.toLowerCase().includes('succ'))) {
                // console.log('Payment successful');
                // Show success result modal
                this.showResultModal(
                  'SUCCESSFUL',
                  'Votre paiement a été traité avec succès.',
                  data.reference
                );


              }
              else if(data.message === "OTP Incorrect."){
                this.showResultModal(
                  'FAILED',
                  'Le code OTP est incorrect',
                  data?.reference
                );
              }
              else if(data.message === "Client introuvable !"){
                this.showResultModal(
                  'FAILED',
                  'Le client est introuvable',
                  data?.reference
                );
              }

              else {
                // console.log('Payment failed');
                // Show error result modal
                this.showResultModal(
                  'FAILED',
                  getApiErrorMessage(data, status, 'Une erreur est survenue lors de la validation du code OTP'),
                  data?.reference
                );

              }
            })
            .catch(error => {
              console.error('FeexPay: OTP validation error', error);

              this.hideOtpModal();

              const payBtn = document.getElementById('feexpay-pay-btn');
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              this.showResultModal(
                'FAILED',
                'Une erreur est survenue lors de la validation du code OTP',
                (initialResponse && initialResponse.reference) || '' // ✅ solution
              );

            });

        });
      }

      // Show the modal
      FeexPayConfig.otpModalElement.style.opacity = '1';
      FeexPayConfig.otpModalElement.style.visibility = 'visible';
      otpModal.style.transform = 'scale(1)';

      // Focus on OTP input
      if (otpInput) {
        setTimeout(() => {
          otpInput.focus();
        }, 300);
      }
    },

    /**
     * Hide the OTP modal
     */
    /**
     * Process card payment
     */
    processCardPayment: function() {
      // Get card information
      const firstNameInput = document.getElementById('feexpay-firstname-input');
      const lastNameInput = document.getElementById('feexpay-lastname-input');
      const emailInput = document.getElementById('feexpay-card-email-input');
      const phoneInput = document.getElementById('feexpay-card-phone-input');
      const cardTypeSelect = document.getElementById('feexpay-card-type');
      const adressInput = document.getElementById('feexpay-card-adress-input');
      const cityInput = document.getElementById('feexpay-card-city-input');
      const zipInput = document.getElementById('feexpay-card-zip-input');
      const countrySelect = document.getElementById('feexpay-card-country-input');

      if (!firstNameInput || !lastNameInput || !emailInput || !phoneInput || !cardTypeSelect || !adressInput || !cityInput || !zipInput || !countrySelect) {
        console.error('FeexPay: Required card form elements not found');
        return;
      }

      const firstName = firstNameInput.value.trim();
      const lastName = lastNameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      const typeCard = cardTypeSelect.value;
      const adress = adressInput.value.trim();
      const city = cityInput.value.trim();
      const zip = zipInput.value.trim();
      const country = countrySelect.value;

      // Validate inputs
      if (!firstName) {
        this.showResultModal('REQUIRED', 'Veuillez entrer votre prénom', '');
        return;
      }

      if (!lastName) {
        this.showResultModal('REQUIRED', 'Veuillez entrer votre nom', '');
        return;
      }

      if (!email) {
        this.showResultModal('REQUIRED', 'Veuillez entrer votre adresse email', '');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.showResultModal('REQUIRED', 'Veuillez entrer une adresse email valide', '');
        return;
      }

      if (!phone || !/\d/.test(phone)) {
        this.showResultModal('REQUIRED', 'Veuillez entrer votre numéro de téléphone', '');
        return;
      }

      // Get the pay button reference
      const payBtn = document.getElementById('feexpay-pay-btn');

      // Show loading state
      if (payBtn) {
        payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
        payBtn.disabled = true;
      }

      // Les frais carte sont gérés selon la zone émetteur, côté serveur

      let cleanPhone = phone.replace(/\D/g, ''); // Retire tous les caractères non numériques


      // Prepare payment data
      const paymentData = {
        shop: FeexPayConfig.options.id,
        amount: FeexPayConfig.options.amount,
        currency: FeexPayConfig.options.currency,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phoneNumber: cleanPhone,
        description: `Paiement par carte bancaire ${typeCard}`
      };

      if (adress) paymentData.address = adress;
      if (city) paymentData.city = city;
      if (zip) paymentData.zip = zip;
      if (country) paymentData.country = country;

      // URL de retour après le paiement par carte : le client quitte la page pour la page
      // de paiement hébergée, c'est donc l'API qui le ramène ici (bouton « Terminer » du reçu).
      if (FeexPayConfig.options.callback_url) {
        paymentData.callback_url = FeexPayConfig.options.callback_url;
      }
      if (FeexPayConfig.options.error_callback_url) {
        paymentData.error_callback_url = FeexPayConfig.options.error_callback_url;
      }

      // Make API request to process card payment

      fetch(`${FeexPayConfig.baseUrl}/api/transactions/public/requesttopay/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FeexPayConfig.options.token}`
        },
        body: JSON.stringify(paymentData)
      })
        .then(response => response.json().then(body => ({ ok: response.ok, body })))
        .then(({ ok, body }) => {
          // Reset button state
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }

          // Redirect to payment page if payment_url is provided
          const paymentUrl = body.payment_url || body.paymentUrl;
          if (ok && paymentUrl) {
            window.location.assign(safePaymentUrl(paymentUrl));
          }
          else {
            // Show error
            const errorMessage = getApiErrorMessage(body, undefined, 'Une erreur est survenue lors de l\'initialisation du paiement par carte');
            this.showResultModal(
              'FAILED',
              errorMessage,
              body.reference || ''
            );
          }
        })
        .catch(error => {
          // console.error('FeexPay: Card payment processing error', error);

          // Reset button state
          if (payBtn) {
            payBtn.textContent = 'Payer';
            payBtn.disabled = false;
          }

          // Show error
          this.showResultModal(
            'FAILED',
            'Une erreur est survenue lors de l\'initialisation du paiement par carte',
            ''
          );
        });
    },

    /**
     * Hide the OTP modal
     */
    /**
     * Process wallet payment
     */
    processWalletPayment: function() {
      const walletCountrySelect = document.getElementById('feexpay-wallet-country-select');
      const walletProviderSelect = document.getElementById('feexpay-wallet-provider-select');
      const walletPhoneInput = document.getElementById('feexpay-wallet-phone-input');

      // Vérifier si les champs sont masqués
      const hideNameField = FeexPayConfig.options.fields_to_hide.includes('name');
      const hideEmailField = FeexPayConfig.options.fields_to_hide.includes('email');

      // Utiliser l'email et le nom de la section Informations Personnelles si disponible et non masqués
      const nameInput = hideNameField ? null : document.getElementById('feexpay-name-input');
      const emailInput = hideEmailField ? null : document.getElementById('feexpay-email-input');

      const country = walletCountrySelect?.value;
      const provider = walletProviderSelect?.value;
      const phone = walletPhoneInput?.value;
      const name = (nameInput?.value || '');
      const email = (emailInput?.value || '');

      // Validation
      if (!phone) {
        this.showResultModal('REQUIRED', 'Veuillez entrer votre numéro de téléphone', '');
        return;
      }

      // Validation de l'email seulement si le champ n'est pas masqué
      if (!hideEmailField && !email) {
        this.showResultModal('REQUIRED', 'Veuillez entrer votre adresse email', '');
        return;
      }

      // Validation du nom seulement si le champ n'est pas masqué
      if (!hideNameField && !name) {
        this.showResultModal('REQUIRED', 'Veuillez entrer votre nom', '');
        return;
      }

      // Get the pay button reference
      const payBtn = document.getElementById('feexpay-pay-btn');

      // Show loading state
      if (payBtn) {
        payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
        payBtn.disabled = true;
      }

      // B-MO : flux dédié en 2 étapes (initiation puis code de confirmation reçu par SMS)
      if (country === 'Benin' && provider === 'BMO') {
        const localPhone = String(phone).replace(/\D/g, '').replace(/^229/, '');
        this.processBmoPayment({
          phoneNumber: '229' + localPhone,
          amount: FeexPayConfig.options.amount,
          shop: FeexPayConfig.options.id,
          description: FeexPayConfig.options.description,
          email: hideEmailField ? '' : email,
          callback_info: FeexPayConfig.options.callback_info,
        }, hideNameField ? '' : name);
        return;
      }

      // Préparer les données pour la requête de vérification des frais
      const checkFeesData = {
        amount: FeexPayConfig.options.amount,
        reseau: getFeeReseau(country, provider),
        shop: FeexPayConfig.options.id
      };

      // Faire une requête API pour récupérer les frais calculés par le serveur
      fetch(`${FeexPayConfig.baseUrl}/api/transactions/details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(checkFeesData)
      })
        .then(response => response.json())
        .then(data => {
          // Déterminer si les frais doivent être appliqués
          const shouldApplyFees = data.iffees === true;
          // console.log('FeexPay Wallet Payment: Should apply fees:', shouldApplyFees, data);

          // Le serveur est la source de vérité : fees et real_amount sont renvoyés directement
          const feeAmount = shouldApplyFees ? Number(data.fees) || 0 : 0;
          const totalAmount = shouldApplyFees
            ? (Number(data.real_amount) || FeexPayConfig.options.amount + feeAmount)
            : FeexPayConfig.options.amount;

          // Prepare payment data
          const paymentData = {
            amount: FeexPayConfig.options.amount,
            phone: phone,
            shop: FeexPayConfig.options.id,
            currency: FeexPayConfig.options.currency,
            // fee: feeAmount,
            // total: totalAmount,
            country: country,
            // provider: provider
          };

          // Ajouter email seulement s'il n'est pas masqué et qu'il est disponible
          if (!hideEmailField && email) {
            paymentData.email = email;
          }

          // Ajouter first_name et last_name seulement s'ils ne sont pas masqués et qu'ils sont disponibles
          if (!hideNameField && name) {
            paymentData.first_name = name.split(' ')[0] || '';
            paymentData.last_name = name.split(' ').slice(1).join(' ') || '';
          }

          // Determine the API endpoint based on the provider
          let networkApiId = '';

          if (country === 'Benin' && provider === 'CORIS') {
            networkApiId = 'coris';
          } else if (country === 'Côte d\'Ivoire' && provider === 'DJAMO') {
            networkApiId = 'djamo_ci';
          } else if (country === 'Côte d\'Ivoire' && provider === 'WAVE') {
            networkApiId = 'wave_ci';
          } else if (country === 'Senegal' && provider === 'WAVE') {
            networkApiId = 'wave sn';
          } else if (country === 'Burkina Faso' && provider === 'WAVE') {
            networkApiId = 'wave bf';
          } else {
            // Reset button state
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }

            this.showResultModal('FAILED', 'Fournisseur de wallet non pris en charge', '');
            return;
          }

          // Make API request to process wallet payment
          this.submitPayment(networkApiId, paymentData);
        })
        .catch(error => {
          // console.error('Error checking transaction fees for wallet payment:', error);

          // En cas d'erreur, procéder sans appliquer de frais
          const feeAmount = 0;
          const totalAmount = FeexPayConfig.options.amount;

          // Prepare payment data without fees
          const paymentData = {
            amount: FeexPayConfig.options.amount,
            phone: phone,
            shop: FeexPayConfig.options.id,
            currency: FeexPayConfig.options.currency,
            // fee: feeAmount,
            // total: totalAmount,
            country: country,
            // provider: provider
          };

          // Ajouter email seulement s'il n'est pas masqué et qu'il est disponible
          if (!hideEmailField && email) {
            paymentData.email = email;
          }

          // Ajouter first_name et last_name seulement s'ils ne sont pas masqués et qu'ils sont disponibles
          if (!hideNameField && name) {
            paymentData.first_name = name.split(' ')[0] || '';
            paymentData.last_name = name.split(' ').slice(1).join(' ') || '';
          }

          // Determine the API endpoint based on the provider
          let networkApiId = '';

          if (country === 'Benin' && provider === 'CORIS') {
            networkApiId = 'coris';
          } else if (country === 'Côte d\'Ivoire' && provider === 'DJAMO') {
            networkApiId = 'djamo_ci';
          } else if (country === 'Côte d\'Ivoire' && provider === 'WAVE') {
            networkApiId = 'wave_ci';
          } else if (country === 'Senegal' && provider === 'WAVE') {
            networkApiId = 'wave sn';
          } else if (country === 'Burkina Faso' && provider === 'WAVE') {
            networkApiId = 'wave bf';
          } else {
            // Reset button state
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }

            this.showResultModal('FAILED', 'Fournisseur de wallet non pris en charge', '');
            return;
          }

          // Make API request to process wallet payment without fees
          this.submitPayment(networkApiId, paymentData);
        });
    },

    /**
     * Hide the OTP modal
     */
    hideOtpModal: function() {
      if (!FeexPayConfig.otpModalElement) return;

      const otpModal = FeexPayConfig.otpModalElement.querySelector('.feexpay-otp-modal');

      // Animate out
      FeexPayConfig.otpModalElement.style.opacity = '0';
      FeexPayConfig.otpModalElement.style.visibility = 'hidden';
      if (otpModal) {
        otpModal.style.transform = 'scale(0.9)';
      }
    },

    /**
     * Process WAVE CI payment
     * @param {Object} paymentData - Payment data for WAVE CI
     */
    /**
     * Poll transaction status for WAVE payments every 5 seconds
     * @param {string} reference - Transaction reference
     * @param {HTMLElement} payBtn - Payment button element
     * @param {Object} paymentData - Original payment data
     */


    pollWaveTransactionStatus: function(reference, payBtn, paymentData) {
      let pollCount = 0;
      const maxPolls = 18; // 3 minutes
      let transaction_id = '';
      let orderId = '';

      const pollInterval = setInterval(() => {
        pollCount++;

        fetch(`${FeexPayConfig.baseUrl}/api/transactions/public/single/status/${reference}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${FeexPayConfig.options.token}`
          }
        })
          .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
          })
          .then(data => {
            transaction_id = data.transaction_id || '';
            orderId = data.orderId || '';
            const status = data.status;
            const reason = data.reason;

            // ✅ Paiement validé
            if (status === 'SUCCESSFUL' || status === 'SUCCESS') {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              this.showResultModal(
                'SUCCESSFUL',
                'Votre paiement a été traité avec succès.',
                data.reference || transaction_id || orderId
              );
              return;
            }

            // ❌ Cas d'échec connus
            if (reason === "LOW_BALANCE_OR_PAYEE_LIMIT_REACHED_OR_NOT_ALLOWED") {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              this.showResultModal(
                'FAILED',
                'Votre solde est insuffisant pour effectuer cette opération.',
                reference || transaction_id || orderId
              );
              return;
            }

            if (reason === "PAYER_NOT_FOUND") {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              this.showResultModal(
                'FAILED',
                'Veuillez bien vérifier le numéro de téléphone et le réseau sélectionné.',
                reference || transaction_id || orderId
              );
              return;
            }

            if (status === 'FAILED' || status === 'CANCELLED') {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              this.showResultModal(
                'FAILED',
                'Le paiement a échoué ou a été annulé.',
                reference || transaction_id || orderId
              );
              return;
            }

            // 🔚 Si le polling atteint la limite
            if (pollCount >= maxPolls) {
              clearInterval(pollInterval);
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              this.showResultModal(
                'FAILED',
                "Nous n'avons pas pu confirmer votre paiement automatiquement. Si vous avez été débité, il sera pris en compte manuellement.",
                reference || transaction_id || orderId
              );
              return;
            }

            // ⏳ Statut inconnu : continuer le polling
            if (payBtn) {
              payBtn.innerHTML = `<span class="feexpay-loading-spinner"></span> Vérification du paiement ...`;
            }
          })
          .catch(error => {
            console.warn("Erreur temporaire lors du polling : ", error.message);

            // ✅ Stopper le polling si c'est une erreur serveur ou critique
            if (
              error.message.includes('500') ||
              error.message.includes('502') ||
              error.message.includes('503') ||
              error.message.includes('504') ||
              error.message.includes('NetworkError') ||
              error.message.includes('Failed to fetch')
            ) {
              clearInterval(pollInterval);

              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              FeexPayButton.handlePaymentFailureCleanup();

              FeexPayButton.showResultModal(
                'FAILED',
                "Une erreur technique est survenue lors de la vérification du paiement. Veuillez réessayer plus tard.",
                reference
              );

              return;
            }

            // Sinon, continuer le polling (par exemple, pour des erreurs temporaires mineures)
            if (payBtn) {
              payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
            }
          });

      }, 15000); // toutes les 15 secondes
    },

    /**
     * Process WAVE CI payment
     * @param {Object} paymentData - Payment data for WAVE CI
     */

    processWaveCIPayment:async function(paymentData) {
      //   console.log('WAVE CI payment data:', paymentData);

      // Get the pay button reference
      const payBtn = document.getElementById('feexpay-pay-btn');

      // Format the phone number correctly
      const walletPhoneInput = document.getElementById('feexpay-wallet-phone-input');
      const phone = walletPhoneInput?.value.trim();

      if (!phone) {
        this.showResultModal('FAILED', 'Veuillez entrer votre numéro de téléphone', '');
        if (payBtn) {
          payBtn.textContent = 'Payer';
          payBtn.disabled = false;
        }
        return;
      }

      // Format the phone number according to the required format
      let country = '';


      // Déterminer le code pays en fonction du pays sélectionné
      const walletCountrySelect = document.getElementById('feexpay-wallet-country-select');
      if (walletCountrySelect?.value === 'Côte d\'Ivoire') {
        country = '225';
      } else {
        // Par défaut, utiliser le code de la Côte d'Ivoire
        country = '225';
      }

      // Formater le numéro de téléphone
      // Enlever tous les caractères non numériques
      let cleanPhone = phone.replace(/\D/g, '');

      // Si le numéro commence par le code pays, l'enlever
      if (cleanPhone.startsWith(country)) {
        cleanPhone = cleanPhone.substring(country.length);
      }

      // Formater le numéro de téléphone pour la partie droite


      // Numéro de téléphone complet avec code pays
      const phoneNumber = country + cleanPhone;

      const fullUrl = window.location.href;
      // Préparer les données de paiement selon le format requis
      const formattedPaymentData = {
        phoneNumber: phoneNumber,
        country: country,

        amount: paymentData.amount.toString(),
        currency: FeexPayConfig.options.currency,
        description: FeexPayConfig.options.description || 'Paiement FeexPay',
        callback_info: FeexPayConfig.options.callback_info,
        reseau: 'WAVE CI',
        shop: FeexPayConfig.options.id,
        token: FeexPayConfig.options.token,
        merchant_domain : window.location.origin,
        payment_interface : "JAVASCRIPT",
        return_url : fullUrl,
      };

      // Ajouter email et first_name seulement s'ils sont disponibles
      if (paymentData.email) {
        formattedPaymentData.email = paymentData.email;
      } else {
        formattedPaymentData.email = ''; // Email par défaut
      }

      if (paymentData.first_name) {
        formattedPaymentData.first_name = paymentData.first_name;
      } else {
        formattedPaymentData.first_name = '' // Nom par défaut
      }

      // Make API request
      // console.log('Sending WAVE CI payment request to:', `${FeexPayConfig.baseUrl}/api/transactions/public/requesttopay/wave_ci`);
      // console.log('With payload:', JSON.stringify(formattedPaymentData, null, 2));

      // Show loading state
      if (payBtn) {
        payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
        payBtn.disabled = true;
      }
      if(FeexPayConfig.options.mode === "LIVE" && FeexPayConfig.options.token.startsWith("fp_")){

        fetch(`${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${formattedPaymentData.token}`
          },
          body: JSON.stringify(formattedPaymentData)
        })
          .then(response => response.json().then(data => ({ status: response.status, data })))
          .then(({ status, data }) => {
            // Pas de lien Wave : l'API a renvoyé une erreur (numéro invalide, Wave non activé…)
            if (!data || !data.payment_url) {
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }
              this.showResultModal(
                'FAILED',
                getApiErrorMessage(data, status, 'Une erreur est survenue lors du traitement du paiement WAVE'),
                (data && data.reference) || ''
              );
              return;
            }

            const iframeContainer = document.createElement('div');
            iframeContainer.style.position = 'fixed';
            iframeContainer.style.top = '0';
            iframeContainer.style.left = '0';
            iframeContainer.style.width = '100vw';
            iframeContainer.style.height = '100vh';
            iframeContainer.style.zIndex = '100000';
            iframeContainer.style.backgroundColor = '#fff';
            iframeContainer.style.margin = '0';
            iframeContainer.style.padding = '0';
            iframeContainer.style.overflow = 'hidden';

            const iframe = document.createElement('iframe');
            iframe.src = safePaymentUrl(data.payment_url);
            iframe.referrerPolicy = 'no-referrer';
            iframe.width = '100%';
            iframe.height = '100%';
            iframe.frameBorder = '0';
            iframe.style.border = 'none';
            iframe.style.overflow = 'hidden';
            iframe.style.display = 'block';

            iframeContainer.appendChild(iframe);
            document.body.appendChild(iframeContainer);



            // Vérifier si nous avons une référence pour vérifier le statut final
            if (data.reference) {
              // console.log('Payment reference received, starting polling:', data.reference);

              // Update button to show polling status
              if (payBtn) {
                payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> Vérification du paiement...';
              }

              // Start polling for transaction status
              this.pollWaveTransactionStatus(data.reference, payBtn, formattedPaymentData);
            } else {
              // console.log('No reference received, cannot check payment status');

              // Reset the payment button
              if (payBtn) {
                payBtn.textContent = 'Payer';
                payBtn.disabled = false;
              }

              // Show error result modal
              this.showResultModal(
                'PAYER_NOT_FOUND',
                'Veuillez bien vérifiez le numéro de téléphone et le réseau selectionné',
                ''
              );


            }
          })
          .catch(error => {
            // console.error('FeexPay: WAVE CI payment processing error', error);

            // Reset button state
            if (payBtn) {
              payBtn.textContent = 'Payer';
              payBtn.disabled = false;
            }

            // Show error in result modal
            this.showResultModal(
              'FAILED',
              'Une erreur est survenue lors du traitement du paiement WAVE',
              ''
            );

            // Call the callback function if it exists

          });
      }
      else if (FeexPayConfig.options.mode === "LIVE" && !FeexPayConfig.options.token.startsWith('fp_')){
        this.showResultModal('FAILED','Le token est invalide')
      }

      else if (FeexPayConfig.options.mode === "SANDBOX" && FeexPayConfig.options.token.startsWith('fp_')){
        this.showResultModal('FAILED','Veillez passer en mode LIVE')
      }
      else{
        this.showResultModal(
          'SUCCESS',
          'Paiement reussi',
          'ref_162672_363738_yEGZHZHzh',
          'ref_162672_363738_yEGZHZHzh'
        );
      }

    },
    /**
     * Process DJAMO CI payment : crée la demande (reseau DJAMO CI), affiche un bouton
     * « Ouvrir Djamo » (le client valide dans son app Djamo) puis vérifie le statut.
     * Un vrai clic sur le lien évite le blocage des popups après un appel asynchrone.
     * @param {Object} paymentData - Payment data for DJAMO CI
     */
    processDjamoCIPayment: function(paymentData) {
      const payBtn = document.getElementById('feexpay-pay-btn');
      const resetBtn = () => {
        if (payBtn) {
          payBtn.textContent = 'Payer';
          payBtn.disabled = false;
        }
      };

      const walletPhoneInput = document.getElementById('feexpay-wallet-phone-input');
      const phone = walletPhoneInput?.value.trim();
      if (!phone) {
        resetBtn();
        this.showResultModal('FAILED', 'Veuillez entrer votre numéro de téléphone', '');
        return;
      }

      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('225') && cleanPhone.length === 13) cleanPhone = cleanPhone.substring(3);

      if (FeexPayConfig.options.mode === 'LIVE' && !FeexPayConfig.options.token.startsWith('fp_')) {
        resetBtn();
        this.showResultModal('FAILED', 'Le token est invalide');
        return;
      }
      if (FeexPayConfig.options.mode === 'SANDBOX' && FeexPayConfig.options.token.startsWith('fp_')) {
        resetBtn();
        this.showResultModal('FAILED', 'Veillez passer en mode LIVE');
        return;
      }
      if (FeexPayConfig.options.mode !== 'LIVE') {
        this.showResultModal('SUCCESS', 'Paiement reussi', 'ref_162672_363738_yEGZHZHzh', 'ref_162672_363738_yEGZHZHzh');
        return;
      }

      const formattedPaymentData = {
        phoneNumber: '225' + cleanPhone,
        country: '225',
        amount: paymentData.amount.toString(),
        currency: FeexPayConfig.options.currency,
        description: FeexPayConfig.options.description || 'Paiement FeexPay',
        callback_info: FeexPayConfig.options.callback_info,
        reseau: 'DJAMO CI',
        shop: FeexPayConfig.options.id,
        merchant_domain: window.location.origin,
        payment_interface: 'JAVASCRIPT',
        return_url: window.location.href,
        email: paymentData.email || '',
        first_name: paymentData.first_name || '',
      };

      if (payBtn) {
        payBtn.innerHTML = '<span class="feexpay-loading-spinner"></span> ';
        payBtn.disabled = true;
      }

      fetch(`${FeexPayConfig.baseUrl}/api/transactions/requesttopay/integration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FeexPayConfig.options.token}`
        },
        body: JSON.stringify(formattedPaymentData)
      })
        .then(response => response.json().then(data => ({ status: response.status, data })))
        .then(({ status, data }) => {
          let paymentUrl = null;
          try { paymentUrl = data && data.payment_url ? safePaymentUrl(data.payment_url) : null; } catch (e) { paymentUrl = null; }

          if (!paymentUrl || !data.reference) {
            resetBtn();
            this.showResultModal(
              'FAILED',
              getApiErrorMessage(data, status, 'Une erreur est survenue lors du traitement du paiement Djamo'),
              (data && data.reference) || ''
            );
            return;
          }

          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:100000;' +
            'background:rgba(17,24,39,0.6);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
          overlay.innerHTML =
            '<div style="background:#fff;border-radius:12px;max-width:360px;width:100%;padding:24px;text-align:center;font-family:Poppins,sans-serif;box-sizing:border-box;">' +
              '<p style="margin:0 0 8px;font-size:18px;font-weight:500;color:#111827;">Paiement Djamo</p>' +
              '<p style="margin:0 0 16px;font-size:14px;color:#374151;">Ouvrez Djamo pour valider le paiement, puis revenez sur cette page.</p>' +
              '<a href="' + escapeHtml(paymentUrl) + '" target="_blank" rel="noopener noreferrer" ' +
                'style="display:block;padding:12px;border-radius:8px;background:#111827;color:#fff;text-decoration:none;font-weight:500;">Ouvrir Djamo</a>' +
              '<p style="margin:16px 0 8px;font-size:12px;color:#6b7280;"><span class="feexpay-loading-spinner"></span> Vérification du paiement en cours…</p>' +
              '<button type="button" data-feexpay-djamo-cancel style="background:none;border:none;color:#6b7280;text-decoration:underline;cursor:pointer;font-size:13px;">Annuler</button>' +
            '</div>';
          document.body.appendChild(overlay);

          const reference = data.reference;
          const maxPolls = 120; // 120 × 5 s = 10 min (la demande Djamo expire après 1 h)
          let pollCount = 0;
          let finished = false;

          const finish = (resultStatus, message) => {
            if (finished) return;
            finished = true;
            clearInterval(pollInterval);
            overlay.remove();
            resetBtn();
            if (resultStatus) this.showResultModal(resultStatus, message, reference, reference);
          };

          overlay.querySelector('[data-feexpay-djamo-cancel]').addEventListener('click', () => finish(null));

          const pollInterval = setInterval(() => {
            pollCount++;
            fetch(`${FeexPayConfig.baseUrl}/api/transactions/public/single/status/${encodeURIComponent(reference)}`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${FeexPayConfig.options.token}` }
            })
              .then(response => {
                if (!response.ok) throw new Error(`HTTP error ${response.status}`);
                return response.json();
              })
              .then(statusData => {
                if (statusData.status === 'SUCCESSFUL' || statusData.status === 'SUCCESS') {
                  finish('SUCCESSFUL', 'Votre paiement a été traité avec succès.');
                } else if (statusData.status === 'FAILED' || statusData.status === 'CANCELLED') {
                  finish('FAILED', 'Le paiement Djamo a échoué, a expiré ou a été annulé.');
                } else if (pollCount >= maxPolls) {
                  finish('FAILED', "Nous n'avons pas pu confirmer votre paiement automatiquement. Si vous avez été débité, il sera pris en compte.");
                }
              })
              .catch(() => {
                if (pollCount >= maxPolls) {
                  finish('FAILED', "Nous n'avons pas pu confirmer votre paiement automatiquement. Si vous avez été débité, il sera pris en compte.");
                }
              });
          }, 5000);
        })
        .catch(() => {
          resetBtn();
          this.showResultModal('FAILED', 'Une erreur est survenue lors du traitement du paiement Djamo', '');
        });
    }

  };

  // Expose FeexPayButton to the global scope
  window.FeexPayButton = FeexPayButton;
})();

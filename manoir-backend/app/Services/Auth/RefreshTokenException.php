<?php

namespace App\Services\Auth;

use RuntimeException;

/**
 * Echec du renouvellement de session. `$reason` sert a la journalisation et
 * aux tests ; le client ne recoit qu'un message generique.
 */
class RefreshTokenException extends RuntimeException
{
    public const INVALID = 'invalid';

    public const EXPIRED = 'expired';

    public const REVOKED = 'revoked';

    public const REPLAYED = 'replayed';

    /** Reutilisation dans la fenetre de grace : un autre onglet vient de rafraichir. */
    public const CONCURRENT = 'concurrent';

    public function __construct(public readonly string $reason)
    {
        parent::__construct('Session expiree. Veuillez vous reconnecter.');
    }
}

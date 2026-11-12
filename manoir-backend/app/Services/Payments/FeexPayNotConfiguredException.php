<?php

namespace App\Services\Payments;

use RuntimeException;

class FeexPayNotConfiguredException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('FeexPay n\'est pas configure (FEEXPAY_API_KEY / FEEXPAY_SHOP_ID).');
    }
}

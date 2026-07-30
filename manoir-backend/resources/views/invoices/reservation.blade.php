<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>{{ $title }} — {{ $invoiceNumber }}</title>
    <style>
        @page { margin: 28px; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #2c2416; font-family: DejaVu Sans, sans-serif; font-size: 11px; }
        .document { border: 1px solid #dfd2ba; }
        .header { width: 100%; padding: 25px 28px; border-bottom: 5px solid #b7791f; background: #fff8e8; }
        .header td { vertical-align: middle; }
        .logo { width: 78px; height: 78px; object-fit: contain; }
        .brand { padding-left: 17px; }
        .brand h1 { margin: 0; color: #3d2817; font-size: 25px; letter-spacing: 6px; }
        .brand p { margin: 5px 0 0; color: #756955; font-size: 8px; }
        .invoice-title { color: #a36211; font-size: 23px; font-weight: bold; text-align: right; text-transform: uppercase; }
        .invoice-meta { margin-top: 10px; color: #5f5547; line-height: 1.6; text-align: right; }
        .content { padding: 27px 30px; }
        .columns { width: 100%; margin-bottom: 25px; }
        .columns td { width: 50%; padding-right: 25px; vertical-align: top; }
        .section-title { margin-bottom: 10px; padding-bottom: 7px; border-bottom: 2px solid #c9a45c; font-size: 13px; font-weight: bold; }
        .strong { margin-bottom: 5px; font-size: 15px; font-weight: bold; }
        .line { margin: 4px 0; color: #5f5547; }
        .items { width: 100%; border-collapse: collapse; }
        .items th { padding: 10px; color: #fff; background: #3d2817; font-size: 9px; text-align: left; }
        .items td { padding: 13px 10px; border-bottom: 1px solid #e6dccb; }
        .right { text-align: right !important; white-space: nowrap; }
        .center { text-align: center !important; }
        .total { width: 45%; margin: 22px 0 22px auto; border-top: 3px solid #b7791f; }
        .total td { padding-top: 12px; font-size: 16px; font-weight: bold; }
        .payment { padding: 14px 18px; border: 1px solid #e5d8c0; background: #faf6ed; line-height: 1.7; }
        .footer { padding: 18px; color: #fff; background: #8b5a2b; text-align: center; }
        .footer p { margin: 3px; }
    </style>
</head>
<body>
<div class="document">
    <table class="header">
        <tr>
            <td style="width: 58%;">
                <table>
                    <tr>
                        <td>@if($logoDataUri)<img class="logo" src="{{ $logoDataUri }}" alt="Logo Le Manoir">@endif</td>
                        <td class="brand">
                            <h1>LE MANOIR</h1>
                            <p>Maison d’hôtes de prestige · Cotonou, Bénin</p>
                            <p>contact@manoir.com · +229 01 00 00 00 00</p>
                        </td>
                    </tr>
                </table>
            </td>
            <td>
                <div class="invoice-title">{{ $title }}</div>
                <div class="invoice-meta">
                    <strong>{{ $invoiceNumber }}</strong><br>
                    Délivrée le {{ $invoiceDate->format('d/m/Y à H:i:s') }}
                </div>
            </td>
        </tr>
    </table>

    <div class="content">
        <table class="columns">
            <tr>
                <td>
                    <div class="section-title">Facturé à</div>
                    <div class="strong">{{ $reservation->user->name }}</div>
                    <div class="line">{{ $reservation->user->email }}</div>
                    <div class="line">{{ $reservation->user->phone ?: 'Téléphone non renseigné' }}</div>
                </td>
                <td>
                    <div class="section-title">Détails du séjour</div>
                    <div class="strong">{{ $roomLabel }}</div>
                    <div class="line">Arrivée : {{ $reservation->check_in->format('d/m/Y') }}</div>
                    <div class="line">Départ : {{ $reservation->check_out->format('d/m/Y') }}</div>
                    <div class="line">{{ $reservation->guests }} occupant(s)</div>
                </td>
            </tr>
        </table>

        <table class="items">
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="center">{{ $quantityLabel }}</th>
                    <th class="right">Prix unitaire</th>
                    <th class="right">Montant</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>{{ $description }}</strong></td>
                    <td class="center">{{ $quantity }}</td>
                    <td class="right">{{ number_format($unitPrice, 0, ',', ' ') }} FCFA</td>
                    <td class="right">{{ number_format($amount, 0, ',', ' ') }} FCFA</td>
                </tr>
            </tbody>
        </table>

        <table class="total">
            <tr>
                <td>Total net</td>
                <td class="right">{{ number_format($amount, 0, ',', ' ') }} FCFA</td>
            </tr>
        </table>

        @if($payment)
            <div class="payment">
                <strong>Informations de paiement</strong><br>
                Moyen : {{ ucfirst(str_replace('_', ' ', $payment->payment_method)) }} ({{ strtoupper($payment->provider) }})<br>
                Transaction : {{ $payment->transaction_id }}<br>
                Statut : Paiement confirmé
            </div>
        @else
            <div class="payment">
                Ce document récapitule les informations enregistrées pour votre réservation au Manoir.
                Conservez-le pour votre suivi.
            </div>
        @endif
    </div>

    <div class="footer">
        <p><strong>Merci de votre confiance.</strong></p>
        <p>LE MANOIR · Cotonou, Bénin · contact@manoir.com</p>
    </div>
</div>
</body>
</html>

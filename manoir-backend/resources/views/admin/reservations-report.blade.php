<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Rapport des réservations — {{ $reference }}</title>
    <style>
        @page { margin: 26px 30px 38px; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            color: #2c2416;
            font-family: DejaVu Sans, sans-serif;
            font-size: 9px;
            line-height: 1.35;
        }
        .header {
            width: 100%;
            padding: 12px 16px;
            border-bottom: 3px solid #c9a45c;
            background: #faf6ed;
        }
        .header td { vertical-align: middle; }
        .logo { width: 58px; height: 58px; border-radius: 50%; object-fit: cover; }
        .brand { padding-left: 12px; }
        .brand-name { margin: 0; color: #3d2817; font-size: 20px; letter-spacing: 5px; }
        .brand-tagline { margin-top: 3px; color: #8b5a2b; font-size: 8px; letter-spacing: 1.2px; }
        .report-title { margin: 0; font-size: 17px; text-align: right; text-transform: uppercase; }
        .report-ref { margin-top: 5px; color: #756955; text-align: right; }
        .meta {
            width: 100%;
            margin: 12px 0;
            border-collapse: collapse;
        }
        .meta td {
            width: 25%;
            padding: 7px 9px;
            border: 1px solid #e5dbc8;
            background: #fffdf9;
        }
        .label {
            display: block;
            margin-bottom: 2px;
            color: #9a7b49;
            font-size: 7px;
            font-weight: bold;
            letter-spacing: .7px;
            text-transform: uppercase;
        }
        .summary { width: 100%; margin-bottom: 12px; border-spacing: 7px 0; }
        .summary td {
            width: 25%;
            padding: 9px 11px;
            border-left: 3px solid #c9a45c;
            background: #f6efe1;
        }
        .summary-value { color: #3d2817; font-size: 15px; font-weight: bold; }
        .summary-label { margin-top: 2px; color: #756955; font-size: 7px; text-transform: uppercase; }
        .data { width: 100%; border-collapse: collapse; }
        .data thead { display: table-header-group; }
        .data tr { page-break-inside: avoid; }
        .data th {
            padding: 8px 6px;
            color: #fffaf0;
            background: #3d2817;
            font-size: 7px;
            letter-spacing: .5px;
            text-align: left;
            text-transform: uppercase;
        }
        .data td { padding: 7px 6px; border-bottom: 1px solid #e8dfd0; vertical-align: top; }
        .data tbody tr:nth-child(even) { background: #faf6ed; }
        .ref { color: #8b5a2b; font-weight: bold; }
        .client { font-weight: bold; }
        .muted { color: #7c7468; font-size: 7px; }
        .amount { white-space: nowrap; text-align: right; }
        .status {
            display: inline-block;
            padding: 3px 5px;
            border: 1px solid #d7c291;
            border-radius: 8px;
            color: #5b4826;
            background: #f4ead2;
            font-size: 6.5px;
            font-weight: bold;
            white-space: nowrap;
        }
        .footer {
            position: fixed;
            right: 0;
            bottom: -25px;
            left: 0;
            padding-top: 7px;
            border-top: 1px solid #d8c8aa;
            color: #857965;
            font-size: 7px;
            text-align: center;
        }
    </style>
</head>
<body>
@php
    $statusLabels = [
        'EN_ATTENTE' => 'En attente',
        'VALIDEE_PAIEMENT_REQUIS' => 'Caution requise',
        'CONFIRMEE' => 'Confirmée',
        'REFUSEE' => 'Refusée',
        'EXPIREE' => 'Expirée',
        'SEJOUR_PAYE' => 'Séjour payé',
        'ANNULEE' => 'Annulée',
        'REMBOURSEE' => 'Remboursée',
        'LIBEREE' => 'Libérée',
    ];
    $categoryLabels = [
        'vip' => 'VIP',
        'deux_chambres' => '2 chambres',
        'une_chambre' => '1 chambre',
    ];
    $money = fn ($value) => number_format((int) $value, 0, ',', ' ').' FCFA';
@endphp

<div class="footer">
    LE MANOIR · Rapport confidentiel destiné à l’administration · {{ $reference }}
</div>

<table class="header">
    <tr>
        <td style="width: 65%;">
            <table>
                <tr>
                    <td>
                        @if($logoDataUri)
                            <img class="logo" src="{{ $logoDataUri }}" alt="Logo Le Manoir">
                        @endif
                    </td>
                    <td class="brand">
                        <h1 class="brand-name">LE MANOIR</h1>
                        <div class="brand-tagline">Maison d’hôtes de prestige · Cotonou</div>
                    </td>
                </tr>
            </table>
        </td>
        <td>
            <h2 class="report-title">Rapport des réservations</h2>
            <div class="report-ref">Référence : {{ $reference }}</div>
        </td>
    </tr>
</table>

<table class="meta">
    <tr>
        <td><span class="label">Exporté le</span>{{ $exportedAt->format('d/m/Y à H:i:s') }}</td>
        <td><span class="label">Établi par</span>{{ $exportedBy->name }} · {{ $exportedBy->email }}</td>
        <td><span class="label">Filtre de statut</span>{{ $filterLabel }}</td>
        <td>
            <span class="label">Période d’arrivée</span>
            {{ $dateFrom ? \Carbon\Carbon::parse($dateFrom)->format('d/m/Y') : 'Début non limité' }}
            —
            {{ $dateTo ? \Carbon\Carbon::parse($dateTo)->format('d/m/Y') : 'Fin non limitée' }}
        </td>
    </tr>
    @if($search)
        <tr>
            <td colspan="4"><span class="label">Recherche appliquée</span>{{ $search }}</td>
        </tr>
    @endif
</table>

<table class="summary">
    <tr>
        <td><div class="summary-value">{{ $reservations->count() }}</div><div class="summary-label">Réservations exportées</div></td>
        <td><div class="summary-value">{{ $money($depositTotal) }}</div><div class="summary-label">Cautions</div></td>
        <td><div class="summary-value">{{ $money($stayTotal) }}</div><div class="summary-label">Séjours</div></td>
        <td><div class="summary-value">{{ $money($depositTotal + $stayTotal) }}</div><div class="summary-label">Montant cumulé</div></td>
    </tr>
</table>

<table class="data">
    <thead>
        <tr>
            <th style="width: 5%;">Réf.</th>
            <th style="width: 17%;">Client</th>
            <th style="width: 18%;">Appartement</th>
            <th style="width: 12%;">Arrivée / départ</th>
            <th style="width: 9%;">Statut</th>
            <th style="width: 8%; text-align:right;">Caution</th>
            <th style="width: 8%; text-align:right;">Séjour</th>
            <th style="width: 8%; text-align:right;">Total</th>
            <th style="width: 15%;">Demande</th>
        </tr>
    </thead>
    <tbody>
    @foreach($reservations as $reservation)
        @php
            $type = $reservation->category_type ?: $reservation->room?->type;
            $roomLabel = $reservation->room?->apartment_number
                ? 'Appartement N°'.$reservation->room->apartment_number.' — '.($categoryLabels[$type] ?? $reservation->room->name)
                : ($categoryLabels[$type] ?? $reservation->room?->name ?? 'Appartement');
            $deposit = (int) ($reservation->deposit_amount ?? $reservation->total_price ?? 0);
            $stay = (int) ($reservation->stay_amount ?? 0);
        @endphp
        <tr>
            <td class="ref">#{{ $reservation->id }}</td>
            <td>
                <div class="client">{{ $reservation->user?->name ?? 'Non renseigné' }}</div>
                <div class="muted">{{ $reservation->user?->email }}</div>
                <div class="muted">{{ $reservation->user?->phone ?: 'Téléphone non renseigné' }}</div>
            </td>
            <td>{{ $roomLabel }}<div class="muted">{{ $reservation->guests }} occupant(s)</div></td>
            <td>{{ $reservation->check_in->format('d/m/Y') }}<br><span class="muted">au {{ $reservation->check_out->format('d/m/Y') }}</span></td>
            <td><span class="status">{{ $statusLabels[$reservation->status] ?? $reservation->status }}</span></td>
            <td class="amount">{{ $money($deposit) }}</td>
            <td class="amount">{{ $money($stay) }}</td>
            <td class="amount"><strong>{{ $money($deposit + $stay) }}</strong></td>
            <td>{{ $reservation->special_requests ?: '—' }}</td>
        </tr>
    @endforeach
    </tbody>
</table>
</body>
</html>

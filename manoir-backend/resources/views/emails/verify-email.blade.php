@extends('emails.layout')

@section('title', 'Confirmez votre adresse e-mail')

@section('preheader', 'Un clic pour activer votre compte Le Manoir.')

@section('content')
    <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#2c2416;">Confirmez votre adresse e-mail</h1>

    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;">Bonjour {{ $name }},</p>

    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;">
        Merci d'avoir créé votre compte sur Le Manoir. Pour l'activer, il vous suffit de confirmer
        que cette adresse e-mail vous appartient en cliquant sur le bouton ci-dessous.
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto;">
        <tr>
            <td align="center" style="border-radius:999px;background:#8b5a2b;">
                <a href="{{ $url }}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">Confirmer mon adresse e-mail</a>
            </td>
        </tr>
    </table>

    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#6b5a4e;">
        Ce lien est valable <strong>{{ $minutes }} minutes</strong> et ne fonctionne qu'une seule fois.
        Une fois votre adresse confirmée, vous serez connecté automatiquement à votre espace client.
    </p>

    <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#9a8b7e;">
        Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :
    </p>
    <p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all;">
        <a href="{{ $url }}" style="color:#8b5a2b;">{{ $url }}</a>
    </p>

    <p style="margin:0;padding:14px 16px;background:#fbf3ec;border-radius:10px;font-size:13px;line-height:1.6;color:#6b5a4e;">
        Vous n'êtes pas à l'origine de cette inscription ? Ignorez simplement ce message :
        aucun compte ne sera activé sans votre confirmation.
    </p>

    <p style="margin:24px 0 0;font-size:14px;color:#7a6b5d;">À très bientôt,<br>L'équipe du Manoir</p>
@endsection

{{--
    Mise en page commune des e-mails du Manoir.

    Le logo est joint au message (image integree, « cid ») plutot que charge
    depuis une URL : il s'affiche meme hors ligne, en local, et sans que la
    messagerie bloque les images distantes.
--}}
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>@yield('title')</title>
</head>
<body style="margin:0;padding:0;background:#f5f1ea;font-family:Arial,Helvetica,sans-serif;color:#2c2416;">
    @hasSection('preheader')
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">@yield('preheader')</div>
    @endif
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1ea;padding:32px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eadbcd;">
                    <tr>
                        <td align="center" style="background:#fbf3ec;padding:28px 28px 22px;border-bottom:1px solid #f0e2d5;">
                            @isset($message)
                                <img src="{{ $message->embed(resource_path('images/logo.jpg')) }}" width="72" height="70" alt="Le Manoir" style="display:block;width:72px;height:auto;border-radius:50%;border:2px solid #e8d2bd;">
                            @endisset
                            <p style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;letter-spacing:4px;text-transform:uppercase;color:#8b5a2b;">Le Manoir</p>
                            <p style="margin:4px 0 0;font-size:12px;color:#9a8b7e;">Maison d'hôtes · Cotonou</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px 32px 28px;">
                            @yield('content')
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 32px 24px;border-top:1px solid #f0e2d5;font-size:12px;line-height:1.6;color:#9a8b7e;">
                            Ce message vous est envoyé automatiquement par Le Manoir. Merci de ne pas y répondre directement.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>

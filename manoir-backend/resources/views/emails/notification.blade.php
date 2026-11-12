<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title }}</title>
</head>
<body style="margin:0;padding:0;background:#f5f1ea;font-family:Georgia,'Times New Roman',serif;color:#2b2420;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1ea;padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6dccb;">
                    <tr>
                        <td style="background:#1f1a17;padding:20px 28px;color:#d8b46a;font-size:20px;letter-spacing:1px;">
                            Le Manoir
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px;">
                            <h1 style="margin:0 0 16px;font-size:22px;color:#1f1a17;">{{ $title }}</h1>

                            @if (! empty($greeting))
                                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">{{ $greeting }}</p>
                            @endif

                            @foreach ($paragraphs as $paragraph)
                                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">{{ $paragraph }}</p>
                            @endforeach

                            @if (! empty($details))
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 20px;border-collapse:collapse;">
                                    @foreach ($details as $label => $value)
                                        <tr>
                                            <td style="padding:8px 0;border-bottom:1px solid #efe7da;font-size:14px;color:#7a6b5d;width:45%;">{{ $label }}</td>
                                            <td style="padding:8px 0;border-bottom:1px solid #efe7da;font-size:14px;font-weight:bold;">{{ $value }}</td>
                                        </tr>
                                    @endforeach
                                </table>
                            @endif

                            @if (! empty($actionUrl))
                                <p style="margin:24px 0;">
                                    <a href="{{ $actionUrl }}" style="display:inline-block;background:#b8893b;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px;">{{ $actionLabel ?? 'Ouvrir' }}</a>
                                </p>
                            @endif

                            <p style="margin:24px 0 0;font-size:14px;color:#7a6b5d;">L'équipe du Manoir</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>

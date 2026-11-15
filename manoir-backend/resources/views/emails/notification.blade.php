@extends('emails.layout')

@section('title', $title)

@section('content')
    <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#2c2416;">{{ $title }}</h1>

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
                    <td style="padding:8px 0;border-bottom:1px solid #f0e2d5;font-size:14px;color:#7a6b5d;width:45%;">{{ $label }}</td>
                    <td style="padding:8px 0;border-bottom:1px solid #f0e2d5;font-size:14px;font-weight:bold;">{{ $value }}</td>
                </tr>
            @endforeach
        </table>
    @endif

    @if (! empty($actionUrl))
        <p style="margin:24px 0;">
            <a href="{{ $actionUrl }}" style="display:inline-block;background:#8b5a2b;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:999px;font-size:15px;font-weight:bold;">{{ $actionLabel ?? 'Ouvrir' }}</a>
        </p>
    @endif

    <p style="margin:24px 0 0;font-size:14px;color:#7a6b5d;">L'équipe du Manoir</p>
@endsection

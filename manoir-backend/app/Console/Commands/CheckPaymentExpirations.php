<?php

namespace App\Console\Commands;

use App\Mail\PaymentReminder;
use App\Models\Notification;
use App\Models\Reservation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class CheckPaymentExpirations extends Command
{
    protected $signature = 'reservations:check-expirations';

    protected $description = 'Vérifie les délais de paiement des réservations approuvées, envoie des relances et expire les réservations dépassées.';

    public function handle()
    {
        $this->info('Début de la vérification des expirations de paiement...');

        $now = now();
        $twoHoursFromNow = now()->addHours(2);

        // 1. Gérer les réservations dont le délai est dépassé
        $expiredReservations = Reservation::where('status', 'VALIDEE_PAIEMENT_REQUIS')
            ->where('payment_deadline', '<=', $now)
            ->with(['user', 'room'])
            ->get();

        foreach ($expiredReservations as $reservation) {
            $reservation->update(['status' => 'EXPIREE']);

            // Enregistrer une notification d'expiration
            Notification::create([
                'user_id' => $reservation->user_id,
                'reservation_id' => $reservation->id,
                'type' => 'expiration',
                'channel' => 'system',
                'status' => 'sent',
                'content' => "La réservation #{$reservation->id} a expiré car le délai de paiement de 24h est dépassé.",
                'sent_at' => now(),
            ]);

            Log::info("Réservation #{$reservation->id} expirée (délai dépassé).");
            $this->warn("Réservation #{$reservation->id} marquée comme expirée.");
        }

        // 2. Gérer les relances de paiement (délai expire dans <= 2 heures)
        $reminderReservations = Reservation::where('status', 'VALIDEE_PAIEMENT_REQUIS')
            ->where('payment_deadline', '>', $now)
            ->where('payment_deadline', '<=', $twoHoursFromNow)
            ->with(['user', 'room'])
            ->get();

        foreach ($reminderReservations as $reservation) {
            // Vérifier si un rappel a déjà été envoyé
            $alreadySent = Notification::where('reservation_id', $reservation->id)
                ->where('type', 'payment_reminder')
                ->exists();

            if (! $alreadySent) {
                try {
                    Mail::to($reservation->user->email)->send(new PaymentReminder($reservation));

                    Notification::create([
                        'user_id' => $reservation->user_id,
                        'reservation_id' => $reservation->id,
                        'type' => 'payment_reminder',
                        'channel' => 'email',
                        'status' => 'sent',
                        'content' => 'Rappel de paiement 2h avant expiration envoyé par email.',
                        'sent_at' => now(),
                    ]);

                    Log::info("Rappel de paiement envoyé pour la réservation #{$reservation->id}.");
                    $this->info("Rappel envoyé pour la réservation #{$reservation->id}.");
                } catch (\Exception $e) {
                    Log::error("Erreur lors de l'envoi du rappel pour la réservation #{$reservation->id} : ".$e->getMessage());
                }
            }
        }

        $tomorrow = now()->addDay()->format('Y-m-d');
        $stayReminderReservations = Reservation::where('status', 'CONFIRMEE')
            ->whereDate('check_out', $tomorrow)
            ->with(['user', 'room'])
            ->get();

        foreach ($stayReminderReservations as $reservation) {
            $alreadySent = Notification::where('reservation_id', $reservation->id)
                ->where('type', 'stay_payment_reminder')
                ->exists();

            if (! $alreadySent) {
                Notification::create([
                    'user_id' => $reservation->user_id,
                    'reservation_id' => $reservation->id,
                    'type' => 'stay_payment_reminder',
                    'channel' => 'system',
                    'status' => 'sent',
                    'content' => 'Votre sejour au Manoir se termine demain. Vous pouvez regler vos frais de sejour directement sur votre espace client.',
                    'sent_at' => now(),
                ]);
            }
        }

        $this->info('Vérification terminée.');
    }
}

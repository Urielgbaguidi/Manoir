<?php

namespace App\Http\Requests\Reservations;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Verification d'un paiement apres le checkout FeexPay.
 *
 * La reference renvoyee par le checkout n'est qu'un indice : le serveur ne
 * la retient que si FeexPay confirme qu'elle correspond a ce paiement.
 */
class InitiatePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reference'))) {
            $this->merge(['reference' => trim($this->input('reference')) ?: null]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reference' => ['nullable', 'string', 'max:100', 'regex:/^[A-Za-z0-9_\-]+$/'],
            // Operateur choisi dans le checkout (affichage seulement).
            'network' => ['nullable', 'string', 'max:40', 'regex:/^[A-Za-z0-9 _\-]+$/'],
        ];
    }
}

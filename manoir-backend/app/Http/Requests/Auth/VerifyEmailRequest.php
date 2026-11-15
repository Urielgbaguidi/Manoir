<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Confirmation d'adresse : e-mail + jeton du lien recu par mail.
 */
class VerifyEmailRequest extends FormRequest
{
    use NormalizesInput;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->normalizeEmail();

        if (is_string($this->input('token'))) {
            $this->merge(['token' => strtolower(trim($this->input('token')))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'token' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['token.regex' => 'Ce lien de confirmation est incomplet. Ouvrez-le directement depuis le mail.'];
    }
}
